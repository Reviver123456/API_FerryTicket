import { nanoid } from 'nanoid';
import { createHash, randomBytes } from 'node:crypto';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { generateAgentCode, generatePaymentRef, generateScheduleCode } from '../utils/ids.js';
import { verifyPassword } from '../utils/password.js';
import {
  assertNonEmptyArray,
  normalizeBoolean,
  normalizeDateString,
  normalizeDateTimeString,
  normalizeEmail,
  normalizeJsonArrayOfStrings,
  normalizeNonNegativeNumber,
  normalizeOptionalString,
  normalizeOptionalUuidish,
  normalizePhone,
  normalizePositiveInteger,
  normalizeString,
  normalizeTimeString,
  normalizeUuidish
} from '../utils/validation.js';
import { assert, throwIfError } from './base.service.js';
import { confirmBooking, createBookingDraft, getBookingByRef } from './booking.service.js';
import {
  assertAgentPriceRuleNoOverlap,
  assertStandardPriceRuleNoOverlap,
  listAgentPriceRules,
  listStandardPriceRules,
  normalizePriceRulePayload,
  resolveTicketPrice
} from './pricing.service.js';
import { issueTicketsForBooking, resendTickets } from './ticket.service.js';
import {
  createAuthIdentity,
  findAuthIdentityByEmail,
  linkAuthIdentityToLocalRecord,
  signInWithSupabasePassword,
  SUPABASE_AUTH_PLACEHOLDER,
  updateAuthIdentity
} from './supabaseAuth.service.js';

const ADMIN_USER_COLUMNS = `
  id,
  name,
  username,
  phone,
  email,
  role,
  status,
  agent_id,
  permissions_override,
  two_factor_enabled,
  two_factor_method,
  last_login_at,
  last_login_ip,
  created_at,
  updated_at,
  agents(id, agent_code, name, company_name, status)
`;

const ADMIN_BOOKING_SELECT = `
  *,
  users(id, full_name, phone, email),
  agents(id, agent_code, name, company_name, status),
  schedules(*),
  booking_items(*, ticket_types(*)),
  passengers(*),
  payments(*),
  tickets(*, passengers(*), ticket_types(*))
`;

const ADMIN_PAYMENT_SELECT = `
  *,
  bookings(
    *,
    users(id, full_name, phone, email),
    agents(id, agent_code, name, company_name, status),
    schedules(*),
    booking_items(*, ticket_types(*)),
    passengers(*),
    tickets(*)
  )
`;

const ADMIN_ROLE_COLUMNS = 'code, name, description, permissions, status, sort_order, created_at, updated_at';
const ALL_PERMISSIONS = [
  'dashboard.view',
  'schedules.view',
  'schedules.manage',
  'ticket_types.view',
  'ticket_types.manage',
  'prices.view',
  'prices.manage',
  'bookings.view',
  'bookings.manage',
  'bookings.cancel',
  'bookings.reschedule',
  'tickets.resend',
  'pos.sell',
  'gate.scan',
  'payments.view',
  'payments.manage',
  'payments.refund',
  'reports.view',
  'users.view',
  'users.manage',
  'roles.view',
  'roles.manage',
  'agents.view',
  'agents.manage',
  'notifications.view',
  'notifications.manage',
  'settings.view',
  'settings.manage'
];
const PAYMENT_METHODS = ['cash', 'transfer', 'qr_promptpay', 'card', 'manual'];
const PASSWORD_RESET_HASH = (token) => createHash('sha256').update(token).digest('hex');

const localDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: env.timezone
}).format(date);

const sortByDateDesc = (items = [], accessor) => [...items].sort((left, right) =>
  new Date(accessor(right) || 0).getTime() - new Date(accessor(left) || 0).getTime()
);

const uniq = (items = []) => [...new Set(items.filter(Boolean))];

const paginate = (items = [], page = 1, limit = 50) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(200, Math.max(1, Number(limit || 50)));
  const start = (safePage - 1) * safeLimit;
  const paged = items.slice(start, start + safeLimit);
  return {
    items: paged,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: items.length,
      total_pages: Math.max(1, Math.ceil(items.length / safeLimit))
    }
  };
};

const escapeCsv = (value) => {
  const normalized = value === null || value === undefined ? '' : String(value);
  if (normalized.includes('"') || normalized.includes(',') || normalized.includes('\n')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const buildCsvExport = (rows = [], columns = []) => {
  const header = columns.map((column) => escapeCsv(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => escapeCsv(column.get(row))).join(',')).join('\n');
  return [header, body].filter(Boolean).join('\n');
};

const buildAuthSessionPayload = (session) => ({
  token: session.access_token,
  refresh_token: session.refresh_token,
  session: {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type
  }
});

const sanitizeAdminUser = ({ permissions_override, auth_user_id, password, ...admin }, permissions = []) => ({
  ...admin,
  permissions
});

const syncAdminAuthIdentity = async (adminUser, password, metadata = {}) => {
  let authUser = adminUser.auth_user_id
    ? { id: adminUser.auth_user_id, email: adminUser.email }
    : await createAuthIdentity({
      email: adminUser.email,
      password,
      scope: 'admin',
      metadata: {
        role: adminUser.role,
        local_admin_user_id: adminUser.id,
        ...metadata
      }
    });

  if (!authUser) {
    authUser = await findAuthIdentityByEmail(adminUser.email);
  }

  assert(authUser, 'Unable to provision authentication account', 500);
  await updateAuthIdentity(authUser.id, {
    password,
    email_confirm: true,
    user_metadata: {
      scope: 'admin',
      role: adminUser.role,
      local_admin_user_id: adminUser.id,
      ...metadata
    }
  });
  await linkAuthIdentityToLocalRecord({
    table: 'admin_users',
    localId: adminUser.id,
    authUserId: authUser.id
  });

  return authUser;
};

const getRoleByCode = async (code) => {
  const normalizedCode = normalizeString(code, { field: 'role', min: 2, max: 50 });
  const { data, error } = await supabase
    .from('admin_roles')
    .select(ADMIN_ROLE_COLUMNS)
    .eq('code', normalizedCode)
    .maybeSingle();

  throwIfError(error);
  return data;
};

const getAdminUserById = async (id) => {
  const normalizedId = normalizeUuidish(id, 'id');
  const { data, error } = await supabase
    .from('admin_users')
    .select(ADMIN_USER_COLUMNS)
    .eq('id', normalizedId)
    .single();

  throwIfError(error, 'Admin user not found', 404);
  const role = await getRoleByCode(data.role);
  const permissions = uniq([
    ...(Array.isArray(role?.permissions) ? role.permissions : []),
    ...(Array.isArray(data.permissions_override) ? data.permissions_override : [])
  ]);
  return sanitizeAdminUser(data, permissions);
};

const createAuditLog = async ({
  adminUserId = null,
  actorRole = null,
  action,
  entityType,
  entityId,
  bookingId = null,
  oldValues = null,
  newValues = null,
  metadata = {}
}) => {
  const { error } = await supabase
    .from('audit_logs')
    .insert([{
      actor_type: 'admin',
      actor_admin_user_id: adminUserId,
      actor_role: actorRole,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      booking_id: bookingId,
      old_values: oldValues,
      new_values: newValues,
      metadata
    }]);

  throwIfError(error, 'Failed to write audit log');
};

const createNotification = async ({
  adminUserId = null,
  bookingId = null,
  ticketId = null,
  userId = null,
  type = 'info',
  priority = 'normal',
  subject,
  message,
  targetPath = null,
  metaJson = {}
}) => {
  const { error } = await supabase
    .from('notifications')
    .insert([{
      admin_user_id: adminUserId,
      booking_id: bookingId,
      ticket_id: ticketId,
      user_id: userId,
      channel: 'system',
      type,
      priority,
      subject: normalizeOptionalString(subject, { field: 'subject', max: 150 }),
      message: normalizeString(message, { field: 'message', min: 2, max: 2000 }),
      status: 'sent',
      sent_at: new Date().toISOString(),
      target_path: normalizeOptionalString(targetPath, { field: 'target_path', max: 255 }),
      meta_json: metaJson
    }]);

  throwIfError(error, 'Failed to create notification');
};

const reserveSeats = async (scheduleId, seatCount) => {
  const { error } = await supabase.rpc('reserve_schedule_seats', {
    p_schedule_id: normalizeUuidish(scheduleId, 'schedule_id'),
    p_seat_count: normalizePositiveInteger(seatCount, 'seat_count')
  });
  throwIfError(error, 'Schedule is unavailable or has insufficient seats', 409);
};

const releaseSeats = async (scheduleId, seatCount) => {
  const { error } = await supabase.rpc('release_schedule_seats', {
    p_schedule_id: normalizeUuidish(scheduleId, 'schedule_id'),
    p_seat_count: normalizePositiveInteger(seatCount, 'seat_count')
  });
  throwIfError(error, 'Unable to release seats');
};

const recalculateScheduleAvailability = async (scheduleId) => {
  const normalizedScheduleId = normalizeUuidish(scheduleId, 'schedule_id');
  const { data: schedule, error: scheduleError } = await supabase
    .from('schedules')
    .select('id, capacity, status')
    .eq('id', normalizedScheduleId)
    .single();

  throwIfError(scheduleError, 'Schedule not found', 404);

  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select('total_passengers, booking_status, expired_at')
    .eq('schedule_id', normalizedScheduleId);

  throwIfError(bookingError);

  const now = Date.now();
  const reserved = (bookings || []).reduce((sum, booking) => {
    if (!['draft', 'pending_payment', 'confirmed'].includes(booking.booking_status)) return sum;
    if (booking.expired_at && new Date(booking.expired_at).getTime() < now && booking.booking_status !== 'confirmed') return sum;
    return sum + Number(booking.total_passengers || 0);
  }, 0);

  const availableSeats = Math.max(0, Number(schedule.capacity) - reserved);
  const { error: updateError } = await supabase
    .from('schedules')
    .update({
      available_seats: availableSeats,
      status: availableSeats === 0 && schedule.status === 'open'
        ? 'closed'
        : schedule.status
    })
    .eq('id', normalizedScheduleId);

  throwIfError(updateError);
  return availableSeats;
};

const loadSchedule = async (scheduleId) => {
  const { data, error } = await supabase
    .from('schedules')
    .select('*, vessels(id, boat_name, registration_no, capacity)')
    .eq('id', normalizeUuidish(scheduleId, 'schedule_id'))
    .single();

  throwIfError(error, 'Schedule not found', 404);
  return data;
};

const loadBookings = async () => {
  const { data, error } = await supabase
    .from('bookings')
    .select(ADMIN_BOOKING_SELECT)
    .order('created_at', { ascending: false });

  throwIfError(error);
  return data || [];
};

const loadPayments = async () => {
  const { data, error } = await supabase
    .from('payments')
    .select(ADMIN_PAYMENT_SELECT)
    .order('created_at', { ascending: false });

  throwIfError(error);
  return data || [];
};

const setBookingPassengers = async (booking, passengers = [], { requireContactEmail = false } = {}) => {
  const normalizedPassengers = (passengers || []).map((passenger, index) => ({
    full_name: normalizeString(passenger.full_name, {
      field: `passengers[${index}].full_name`,
      min: 2,
      max: 120
    }),
    passenger_type: normalizeString(passenger.passenger_type || 'adult', {
      field: `passengers[${index}].passenger_type`,
      min: 2,
      max: 30
    }),
    remark: normalizeOptionalString(passenger.remark, {
      field: `passengers[${index}].remark`,
      max: 255
    })
  }));

  assert(normalizedPassengers.length === Number(booking.total_passengers), 'Passenger count must match reserved seats', 409);

  if ((booking.passengers || []).length === 0) {
    const { error } = await supabase.from('passengers').insert(normalizedPassengers.map((passenger) => ({
      booking_id: booking.id,
      ...passenger
    })));
    throwIfError(error);
    return;
  }

  const existingPassengers = sortByDateDesc(booking.passengers, (item) => item.created_at).reverse();
  assert(existingPassengers.length === normalizedPassengers.length, 'Passenger count mismatch', 409);

  for (let index = 0; index < existingPassengers.length; index += 1) {
    const passenger = existingPassengers[index];
    const payload = normalizedPassengers[index];
    const { error } = await supabase
      .from('passengers')
      .update(payload)
      .eq('id', passenger.id);

    throwIfError(error);
  }

  if (requireContactEmail) {
    assert(booking.contact_email, 'contact_email is required', 409);
  }
};

const updateBookingContact = async (booking, payload = {}, { requireContactEmail = false } = {}) => {
  const updatePayload = {};

  if (payload.contact_name !== undefined) {
    updatePayload.contact_name = normalizeString(payload.contact_name, {
      field: 'contact_name',
      min: 2,
      max: 120
    });
  }

  if (payload.contact_phone !== undefined) {
    updatePayload.contact_phone = normalizePhone(payload.contact_phone, { required: false });
  }

  if (payload.contact_email !== undefined) {
    updatePayload.contact_email = normalizeEmail(payload.contact_email, { required: false });
  }

  if (payload.notes !== undefined) {
    updatePayload.notes = normalizeOptionalString(payload.notes, { field: 'notes', max: 2000 });
  }

  if (requireContactEmail) {
    assert(updatePayload.contact_email || booking.contact_email, 'contact_email is required');
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', booking.id);

    throwIfError(error);
  }
};

const cancelActiveTickets = async (bookingId) => {
  const { error } = await supabase
    .from('tickets')
    .update({ status: 'cancelled' })
    .eq('booking_id', bookingId)
    .neq('status', 'used');

  throwIfError(error);
};

const ensureBookingTicketsNotUsed = (booking) => {
  const usedTicket = (booking.tickets || []).find((ticket) => ticket.status === 'used' || ticket.used_at);
  assert(!usedTicket, 'Booking has already used tickets and cannot be changed', 409);
};

const refundPaymentRecord = async (paymentRef, payload = {}, admin) => {
  const payment = await getAdminPaymentDetail(paymentRef);
  assert(payment.status === 'success', 'Only successful payments can be refunded', 409);

  const now = new Date().toISOString();
  const refundReason = normalizeOptionalString(payload.refund_reason, { field: 'refund_reason', max: 255 }) || 'manual_refund';
  const referenceNo = normalizeOptionalString(payload.reference_no, { field: 'reference_no', max: 120 });

  const { error: paymentError } = await supabase
    .from('payments')
    .update({
      status: 'refunded',
      refund_reason: refundReason,
      refunded_at: now,
      reference_no: referenceNo,
      confirmed_by_admin_id: admin.id
    })
    .eq('id', payment.id);

  throwIfError(paymentError);

  const booking = payment.bookings;
  if (booking && booking.booking_status !== 'cancelled') {
    ensureBookingTicketsNotUsed(booking);

    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        booking_status: 'cancelled',
        cancelled_at: now,
        cancel_reason: refundReason
      })
      .eq('id', booking.id);

    throwIfError(bookingError);
    await cancelActiveTickets(booking.id);
    await releaseSeats(booking.schedule_id, booking.total_passengers);
    await recalculateScheduleAvailability(booking.schedule_id);
  }

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'payment.refunded',
    entityType: 'payment',
    entityId: payment.payment_ref,
    bookingId: booking?.id || null,
    oldValues: { status: payment.status },
    newValues: { status: 'refunded', refund_reason: refundReason },
    metadata: { reference_no: referenceNo }
  });

  await createNotification({
    bookingId: booking?.id || null,
    adminUserId: admin.id,
    type: 'warning',
    priority: 'high',
    subject: `Refunded ${payment.payment_ref}`,
    message: `Payment ${payment.payment_ref} has been refunded`,
    targetPath: booking ? `/admin/bookings/${booking.booking_no}` : `/admin/payments/${payment.payment_ref}`,
    metaJson: {
      payment_ref: payment.payment_ref,
      refund_reason: refundReason
    }
  });

  return getAdminPaymentDetail(payment.payment_ref);
};

export const adminPermissionsCatalog = () => ({
  permissions: ALL_PERMISSIONS
});

export const loginAdmin = async ({ username_or_email, email, username, password, remember_me = false }, context = {}) => {
  const identifier = normalizeOptionalString(username_or_email, {
    field: 'username_or_email',
    min: 2,
    max: 255
  }) || normalizeOptionalString(email, { field: 'email', min: 5, max: 255 }) || normalizeOptionalString(username, {
    field: 'username',
    min: 3,
    max: 120
  });
  const normalizedPassword = normalizeString(password, {
    field: 'password',
    min: 1,
    max: 128,
    trim: false
  });

  assert(identifier, 'username_or_email is required');

  let builder = supabase.from('admin_users').select(`${ADMIN_USER_COLUMNS}, password, auth_user_id`);
  if (identifier.includes('@')) {
    builder = builder.eq('email', normalizeEmail(identifier));
  } else {
    builder = builder.eq('username', normalizeString(identifier, { field: 'username', min: 3, max: 120 }));
  }

  const { data, error } = await builder.maybeSingle();
  throwIfError(error);
  assert(data, 'Invalid credentials', 401);
  assert(data.status === 'active', 'Admin account is not active', 403);

  if (data.auth_user_id || data.password === SUPABASE_AUTH_PLACEHOLDER) {
    if (!data.auth_user_id) {
      const authUser = await findAuthIdentityByEmail(data.email);
      assert(authUser, 'Authentication account is not linked correctly', 500);
      await linkAuthIdentityToLocalRecord({
        table: 'admin_users',
        localId: data.id,
        authUserId: authUser.id
      });
    }
  } else {
    const isValidPassword = await verifyPassword(normalizedPassword, data.password);
    assert(isValidPassword, 'Invalid credentials', 401);
    await syncAdminAuthIdentity(data, normalizedPassword);
  }

  const authSession = await signInWithSupabasePassword({
    email: data.email,
    password: normalizedPassword
  });

  const role = await getRoleByCode(data.role);
  const permissions = uniq([
    ...(Array.isArray(role?.permissions) ? role.permissions : []),
    ...(Array.isArray(data.permissions_override) ? data.permissions_override : [])
  ]);

  const { error: lastLoginError } = await supabase
    .from('admin_users')
    .update({
      last_login_at: new Date().toISOString(),
      last_login_ip: context.ipAddress || null
    })
    .eq('id', data.id);

  throwIfError(lastLoginError);

  const admin = sanitizeAdminUser(data, permissions);
  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'admin.login',
    entityType: 'admin_user',
    entityId: admin.id,
    metadata: {
      ip_address: context.ipAddress || null,
      user_agent: context.userAgent || null,
      remember_me: normalizeBoolean(remember_me, 'remember_me', false)
    }
  });

  return {
    admin,
    permissions,
    ...buildAuthSessionPayload(authSession.session)
  };
};

export const getAdminMe = async (adminId) => getAdminUserById(adminId);

export const createAdminPasswordResetRequest = async ({ email }, context = {}) => {
  const normalizedEmail = normalizeEmail(email);
  const { data: admin, error } = await supabase
    .from('admin_users')
    .select('id, email, status')
    .eq('email', normalizedEmail)
    .maybeSingle();

  throwIfError(error);

  const response = {
    sent: true,
    message: 'If the email exists, a password reset link has been created'
  };

  if (!admin || admin.status !== 'active') return response;

  const token = randomBytes(32).toString('hex');
  const tokenHash = PASSWORD_RESET_HASH(token);
  const expiresAt = new Date(Date.now() + (env.passwordResetExpiresMinutes * 60 * 1000)).toISOString();

  const { error: cleanupError } = await supabase
    .from('admin_password_reset_tokens')
    .delete()
    .eq('admin_user_id', admin.id);
  throwIfError(cleanupError);

  const { error: insertError } = await supabase
    .from('admin_password_reset_tokens')
    .insert([{
      admin_user_id: admin.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      requested_ip: context.ipAddress || null,
      user_agent: context.userAgent || null
    }]);
  throwIfError(insertError);

  if (!env.isProduction) {
    response.debug = {
      reset_token: token,
      reset_url: `${env.adminPasswordResetUrl}?token=${encodeURIComponent(token)}`,
      expires_at: expiresAt
    };
  }

  return response;
};

export const resetAdminPassword = async ({ token, new_password }) => {
  const normalizedToken = normalizeString(token, { field: 'token', min: 32, max: 255 });
  const normalizedPassword = normalizeString(new_password, {
    field: 'new_password',
    min: env.minPasswordLength,
    max: 128,
    trim: false
  });

  const { data: resetRequest, error } = await supabase
    .from('admin_password_reset_tokens')
    .select('id, admin_user_id, expires_at, used_at')
    .eq('token_hash', PASSWORD_RESET_HASH(normalizedToken))
    .maybeSingle();

  throwIfError(error);
  assert(resetRequest, 'Invalid or expired reset token', 400);
  assert(!resetRequest.used_at, 'Invalid or expired reset token', 400);
  assert(new Date(resetRequest.expires_at).getTime() > Date.now(), 'Invalid or expired reset token', 400);

  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('id, email, role, status, auth_user_id')
    .eq('id', resetRequest.admin_user_id)
    .single();
  throwIfError(adminError, 'Admin user not found', 404);
  assert(adminUser.status === 'active', 'Admin account is not active', 403);

  await syncAdminAuthIdentity(adminUser, normalizedPassword);
  const now = new Date().toISOString();

  const { error: markUsedError } = await supabase
    .from('admin_password_reset_tokens')
    .update({ used_at: now })
    .eq('admin_user_id', resetRequest.admin_user_id)
    .is('used_at', null);
  throwIfError(markUsedError);

  return { reset: true };
};

export const getDashboard = async (query = {}) => {
  const targetDate = normalizeDateString(query.date, 'date', { required: false }) || localDate();
  const dateFrom = normalizeDateString(query.date_from, 'date_from', { required: false }) || targetDate;
  const dateTo = normalizeDateString(query.date_to, 'date_to', { required: false }) || targetDate;

  const [bookings, payments, tickets, schedules, notifications] = await Promise.all([
    loadBookings(),
    loadPayments(),
    supabase.from('tickets').select('id, ticket_no, status, issued_at, used_at, schedule_id'),
    supabase.from('schedule_overview').select('*').order('trip_date', { ascending: true }).order('departure_time', { ascending: true }),
    supabase.from('notifications').select('id, subject, message, type, priority, is_read, created_at, target_path').order('created_at', { ascending: false }).limit(20)
  ]);

  const ticketRows = tickets.data || [];
  throwIfError(tickets.error);
  throwIfError(schedules.error);
  throwIfError(notifications.error);

  const bookingsToday = bookings.filter((booking) => (booking.created_at || '').slice(0, 10) === targetDate).length;
  const ticketsSoldToday = ticketRows.filter((ticket) => (ticket.issued_at || '').slice(0, 10) === targetDate).length;
  const revenueToday = payments
    .filter((payment) => payment.status === 'success' && (payment.paid_at || '').slice(0, 10) === targetDate)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const passengersToday = bookings
    .filter((booking) => booking.booking_status === 'confirmed' && booking.schedules?.trip_date === targetDate)
    .reduce((sum, booking) => sum + Number(booking.total_passengers || 0), 0);

  const upcomingSchedules = (schedules.data || []).filter((schedule) => schedule.trip_date >= targetDate).slice(0, 10);
  const recentPayments = payments.slice(0, 10);
  const unreadNotifications = (notifications.data || []).filter((item) => !item.is_read).length;

  const alerts = [
    ...(schedules.data || [])
      .filter((schedule) => schedule.status === 'open' && Number(schedule.available_seats) <= Math.max(5, Math.floor(Number(schedule.capacity || 0) * 0.1)))
      .slice(0, 5)
      .map((schedule) => ({
        type: 'warning',
        message: `Schedule ${schedule.schedule_code} is almost full`,
        target_path: `/admin/schedules/${schedule.id}`
      })),
    ...(payments
      .filter((payment) => payment.status === 'failed')
      .slice(0, 5)
      .map((payment) => ({
        type: 'danger',
        message: `Payment ${payment.payment_ref} failed`,
        target_path: `/admin/payments/${payment.payment_ref}`
      })))
  ];

  return {
    filters: { date_from: dateFrom, date_to: dateTo },
    kpis: {
      bookings_today: bookingsToday,
      tickets_sold_today: ticketsSoldToday,
      revenue_today: revenueToday,
      passengers_today: passengersToday,
      unread_notifications: unreadNotifications
    },
    upcoming_schedules: upcomingSchedules,
    recent_payments: recentPayments,
    alerts,
    quick_actions: [
      { key: 'sell_ticket', label: 'Sell Ticket', path: '/admin/pos/sales' },
      { key: 'scan_ticket', label: 'Scan Ticket', path: '/admin/gate/scan' },
      { key: 'create_schedule', label: 'Add Schedule', path: '/admin/schedules' },
      { key: 'view_bookings', label: 'View Bookings', path: '/admin/bookings' }
    ]
  };
};

export const listAdminSchedules = async (query = {}) => {
  const tripDate = normalizeDateString(query.trip_date, 'trip_date', { required: false });
  const status = normalizeOptionalString(query.status, { field: 'status', min: 2, max: 20 });
  const routeName = normalizeOptionalString(query.route_name, { field: 'route_name', min: 2, max: 120 });

  let builder = supabase
    .from('schedule_overview')
    .select('*')
    .order('trip_date', { ascending: true })
    .order('departure_time', { ascending: true });

  if (tripDate) builder = builder.eq('trip_date', tripDate);
  if (status) builder = builder.eq('status', status);
  if (routeName) builder = builder.eq('route_name', routeName);

  const { data, error } = await builder;
  throwIfError(error);

  return data || [];
};

export const getAdminSchedule = async (id) => {
  const schedule = await loadSchedule(id);
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, booking_no, total_passengers, booking_status')
    .eq('schedule_id', schedule.id)
    .order('created_at', { ascending: false });

  throwIfError(error);

  return {
    ...schedule,
    bookings: bookings || []
  };
};

export const createAdminSchedule = async (payload, admin) => {
  const routeName = normalizeOptionalString(payload.route_name, { field: 'route_name', min: 2, max: 120 });
  const originPort = normalizeOptionalString(payload.origin_port, { field: 'origin_port', min: 2, max: 120 });
  const destinationPort = normalizeOptionalString(payload.destination_port, { field: 'destination_port', min: 2, max: 120 });
  const tripDate = normalizeDateString(payload.trip_date, 'trip_date', { required: true });
  const departureTime = normalizeTimeString(payload.departure_time, 'departure_time', { required: true });
  const arrivalTime = normalizeTimeString(payload.arrival_time, 'arrival_time', { required: false });
  const capacity = normalizePositiveInteger(payload.capacity, 'capacity');
  const vesselId = normalizeOptionalUuidish(payload.vessel_id, 'vessel_id');
  const status = normalizeString(payload.status || 'open', { field: 'status', min: 2, max: 20 });
  const scheduleCode = normalizeOptionalString(payload.schedule_code, { field: 'schedule_code', min: 4, max: 50 }) || generateScheduleCode();

  const duplicateQuery = await supabase
    .from('schedules')
    .select('id')
    .eq('trip_date', tripDate)
    .eq('departure_time', departureTime)
    .eq('route_name', routeName || `${originPort || 'Port A'} - ${destinationPort || 'Port B'}`)
    .maybeSingle();
  throwIfError(duplicateQuery.error);
  assert(!duplicateQuery.data, 'Schedule already exists for the selected route and time', 409);

  const insertPayload = {
    schedule_code: scheduleCode,
    trip_date: tripDate,
    departure_time: departureTime,
    arrival_time: arrivalTime,
    vessel_id: vesselId,
    capacity,
    available_seats: capacity,
    status,
    route_name: routeName || `${originPort || 'Port A'} - ${destinationPort || 'Port B'}`,
    origin_port: originPort || 'Port A',
    destination_port: destinationPort || 'Port B'
  };

  const { data, error } = await supabase
    .from('schedules')
    .insert([insertPayload])
    .select('*')
    .single();

  throwIfError(error);
  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'schedule.created',
    entityType: 'schedule',
    entityId: data.id,
    newValues: insertPayload
  });
  return data;
};

export const updateAdminSchedule = async (id, payload, admin) => {
  const schedule = await loadSchedule(id);
  const updatePayload = {};

  if (payload.trip_date !== undefined) updatePayload.trip_date = normalizeDateString(payload.trip_date, 'trip_date', { required: true });
  if (payload.departure_time !== undefined) updatePayload.departure_time = normalizeTimeString(payload.departure_time, 'departure_time', { required: true });
  if (payload.arrival_time !== undefined) updatePayload.arrival_time = normalizeTimeString(payload.arrival_time, 'arrival_time', { required: false });
  if (payload.route_name !== undefined) updatePayload.route_name = normalizeOptionalString(payload.route_name, { field: 'route_name', min: 2, max: 120 });
  if (payload.origin_port !== undefined) updatePayload.origin_port = normalizeOptionalString(payload.origin_port, { field: 'origin_port', min: 2, max: 120 });
  if (payload.destination_port !== undefined) updatePayload.destination_port = normalizeOptionalString(payload.destination_port, { field: 'destination_port', min: 2, max: 120 });
  if (payload.status !== undefined) updatePayload.status = normalizeString(payload.status, { field: 'status', min: 2, max: 20 });
  if (payload.cancel_reason !== undefined) updatePayload.cancel_reason = normalizeOptionalString(payload.cancel_reason, { field: 'cancel_reason', max: 255 });
  if (payload.vessel_id !== undefined) updatePayload.vessel_id = normalizeOptionalUuidish(payload.vessel_id, 'vessel_id');

  if (updatePayload.status === 'cancelled') {
    updatePayload.cancelled_at = new Date().toISOString();
  } else if (updatePayload.status && updatePayload.status !== 'cancelled') {
    updatePayload.cancelled_at = null;
  }

  if (payload.capacity !== undefined) {
    const nextCapacity = normalizePositiveInteger(payload.capacity, 'capacity');
    const { data: activeBookings, error: bookingError } = await supabase
      .from('bookings')
      .select('total_passengers, booking_status, expired_at')
      .eq('schedule_id', schedule.id);

    throwIfError(bookingError);
    const reservedPassengers = (activeBookings || []).reduce((sum, booking) => {
      if (!['draft', 'pending_payment', 'confirmed'].includes(booking.booking_status)) return sum;
      if (booking.expired_at && new Date(booking.expired_at).getTime() < Date.now() && booking.booking_status !== 'confirmed') return sum;
      return sum + Number(booking.total_passengers || 0);
    }, 0);

    assert(nextCapacity >= reservedPassengers, 'capacity cannot be lower than reserved seats', 409);
    updatePayload.capacity = nextCapacity;
    updatePayload.available_seats = Math.max(0, nextCapacity - reservedPassengers);
  }

  const { data, error } = await supabase
    .from('schedules')
    .update(updatePayload)
    .eq('id', schedule.id)
    .select('*')
    .single();

  throwIfError(error);
  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'schedule.updated',
    entityType: 'schedule',
    entityId: schedule.id,
    oldValues: schedule,
    newValues: updatePayload
  });
  return data;
};

export const openScheduleSales = async (id, admin) => updateAdminSchedule(id, {
  status: 'open',
  cancel_reason: null
}, admin);

export const closeScheduleSales = async (id, admin) => updateAdminSchedule(id, {
  status: 'closed'
}, admin);

export const cancelSchedule = async (id, payload, admin) => {
  const schedule = await getAdminSchedule(id);
  const reason = normalizeOptionalString(payload.reason, { field: 'reason', max: 255 }) || 'schedule_cancelled';
  const activeBookingSummaries = (schedule.bookings || []).filter((booking) => ['draft', 'pending_payment', 'confirmed'].includes(booking.booking_status));
  const activeBookings = [];

  for (const bookingSummary of activeBookingSummaries) {
    const booking = await getBookingByRef(bookingSummary.booking_no);
    ensureBookingTicketsNotUsed(booking);
    activeBookings.push(booking);
  }

  for (const booking of activeBookings) {
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        booking_status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason
      })
      .eq('id', booking.id);

    throwIfError(bookingError);
    await cancelActiveTickets(booking.id);
  }

  await updateAdminSchedule(id, {
    status: 'cancelled',
    cancel_reason: reason
  }, admin);

  await recalculateScheduleAvailability(id);
  return getAdminSchedule(id);
};

export const listAdminTicketTypes = async () => {
  const { data, error } = await supabase
    .from('ticket_types')
    .select('*')
    .order('display_order', { ascending: true })
    .order('code', { ascending: true });

  throwIfError(error);
  return data || [];
};

export const createAdminTicketType = async (payload, admin) => {
  const insertPayload = {
    name_th: normalizeString(payload.name_th, { field: 'name_th', min: 2, max: 120 }),
    code: normalizeString(payload.code, { field: 'code', min: 2, max: 30 }).toUpperCase(),
    price: normalizeNonNegativeNumber(payload.price, 'price'),
    description: normalizeOptionalString(payload.description, { field: 'description', max: 255 }),
    benefit_text: normalizeOptionalString(payload.benefit_text, { field: 'benefit_text', max: 255 }),
    status: normalizeString(payload.status || 'active', { field: 'status', min: 2, max: 20 }),
    display_order: payload.display_order === undefined ? 0 : Number(payload.display_order),
    requires_document: normalizeBoolean(payload.requires_document, 'requires_document', false),
    special_condition: normalizeOptionalString(payload.special_condition, { field: 'special_condition', max: 255 })
  };

  assert(Number.isInteger(insertPayload.display_order), 'display_order must be an integer');

  const { data, error } = await supabase
    .from('ticket_types')
    .insert([insertPayload])
    .select('*')
    .single();

  throwIfError(error);
  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'ticket_type.created',
    entityType: 'ticket_type',
    entityId: data.id,
    newValues: insertPayload
  });
  return data;
};

export const updateAdminTicketType = async (id, payload, admin) => {
  const ticketTypeId = normalizeUuidish(id, 'id');
  const { data: ticketType, error: existingError } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('id', ticketTypeId)
    .single();
  throwIfError(existingError, 'Ticket type not found', 404);

  const updatePayload = {};
  if (payload.name_th !== undefined) updatePayload.name_th = normalizeString(payload.name_th, { field: 'name_th', min: 2, max: 120 });
  if (payload.code !== undefined) updatePayload.code = normalizeString(payload.code, { field: 'code', min: 2, max: 30 }).toUpperCase();
  if (payload.price !== undefined) updatePayload.price = normalizeNonNegativeNumber(payload.price, 'price');
  if (payload.description !== undefined) updatePayload.description = normalizeOptionalString(payload.description, { field: 'description', max: 255 });
  if (payload.benefit_text !== undefined) updatePayload.benefit_text = normalizeOptionalString(payload.benefit_text, { field: 'benefit_text', max: 255 });
  if (payload.status !== undefined) updatePayload.status = normalizeString(payload.status, { field: 'status', min: 2, max: 20 });
  if (payload.display_order !== undefined) {
    updatePayload.display_order = Number(payload.display_order);
    assert(Number.isInteger(updatePayload.display_order), 'display_order must be an integer');
  }
  if (payload.requires_document !== undefined) updatePayload.requires_document = normalizeBoolean(payload.requires_document, 'requires_document', false);
  if (payload.special_condition !== undefined) updatePayload.special_condition = normalizeOptionalString(payload.special_condition, { field: 'special_condition', max: 255 });

  const { data, error } = await supabase
    .from('ticket_types')
    .update(updatePayload)
    .eq('id', ticketTypeId)
    .select('*')
    .single();
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'ticket_type.updated',
    entityType: 'ticket_type',
    entityId: ticketTypeId,
    oldValues: ticketType,
    newValues: updatePayload
  });
  return data;
};

export const createStandardPriceRule = async (payload, admin) => {
  const normalized = normalizePriceRulePayload(payload);
  await assertStandardPriceRuleNoOverlap(normalized);

  const { data, error } = await supabase
    .from('ticket_price_rules')
    .insert([{
      ...normalized,
      created_by_admin_id: admin.id
    }])
    .select('*')
    .single();
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'price_rule.created',
    entityType: 'ticket_price_rule',
    entityId: data.id,
    newValues: normalized
  });
  return data;
};

export const updateStandardPriceRule = async (id, payload, admin) => {
  const ruleId = normalizeUuidish(id, 'id');
  const { data: existing, error: existingError } = await supabase
    .from('ticket_price_rules')
    .select('*')
    .eq('id', ruleId)
    .single();
  throwIfError(existingError, 'Price rule not found', 404);

  const normalized = normalizePriceRulePayload({
    ...existing,
    ...payload
  });
  await assertStandardPriceRuleNoOverlap({
    ...normalized,
    exclude_id: ruleId
  });

  const { data, error } = await supabase
    .from('ticket_price_rules')
    .update(normalized)
    .eq('id', ruleId)
    .select('*')
    .single();
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'price_rule.updated',
    entityType: 'ticket_price_rule',
    entityId: ruleId,
    oldValues: existing,
    newValues: normalized
  });
  return data;
};

export const createAgentPriceRule = async (payload, admin) => {
  const normalized = normalizePriceRulePayload(payload, { requireAgent: true });
  await assertAgentPriceRuleNoOverlap(normalized);

  const { data, error } = await supabase
    .from('agent_price_rules')
    .insert([{
      ...normalized,
      created_by_admin_id: admin.id
    }])
    .select('*')
    .single();
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'agent_price_rule.created',
    entityType: 'agent_price_rule',
    entityId: data.id,
    newValues: normalized
  });
  return data;
};

export const updateAgentPriceRule = async (id, payload, admin) => {
  const ruleId = normalizeUuidish(id, 'id');
  const { data: existing, error: existingError } = await supabase
    .from('agent_price_rules')
    .select('*')
    .eq('id', ruleId)
    .single();
  throwIfError(existingError, 'Agent price rule not found', 404);

  const normalized = normalizePriceRulePayload({
    ...existing,
    ...payload
  }, { requireAgent: true });
  await assertAgentPriceRuleNoOverlap({
    ...normalized,
    exclude_id: ruleId
  });

  const { data, error } = await supabase
    .from('agent_price_rules')
    .update(normalized)
    .eq('id', ruleId)
    .select('*')
    .single();
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'agent_price_rule.updated',
    entityType: 'agent_price_rule',
    entityId: ruleId,
    oldValues: existing,
    newValues: normalized
  });
  return data;
};

export const previewResolvedPrice = async (query = {}) => resolveTicketPrice({
  ticket_type_id: query.ticket_type_id,
  schedule_id: query.schedule_id,
  agent_id: query.agent_id,
  trip_date: query.trip_date,
  route_name: query.route_name
});

const flattenBookingForCsv = (booking) => ({
  booking_no: booking.booking_no,
  booking_status: booking.booking_status,
  trip_date: booking.schedules?.trip_date || '',
  schedule_code: booking.schedules?.schedule_code || '',
  route_name: booking.schedules?.route_name || '',
  contact_name: booking.contact_name || '',
  contact_phone: booking.contact_phone || '',
  contact_email: booking.contact_email || '',
  total_passengers: booking.total_passengers,
  total_amount: booking.total_amount,
  payment_status: (booking.payments || []).map((payment) => payment.status).join('|'),
  ticket_status: (booking.tickets || []).map((ticket) => ticket.status).join('|'),
  source_channel: booking.source_channel || '',
  agent_name: booking.agents?.company_name || booking.agents?.name || '',
  created_at: booking.created_at
});

export const listAdminBookings = async (query = {}) => {
  const bookings = await loadBookings();
  const filters = {
    booking_no: normalizeOptionalString(query.booking_no, { field: 'booking_no', min: 3, max: 40 }),
    passenger_name: normalizeOptionalString(query.passenger_name, { field: 'passenger_name', min: 2, max: 120 }),
    phone: normalizeOptionalString(query.phone, { field: 'phone', min: 3, max: 20 }),
    trip_date: normalizeDateString(query.trip_date, 'trip_date', { required: false }),
    schedule_id: normalizeOptionalUuidish(query.schedule_id, 'schedule_id'),
    payment_status: normalizeOptionalString(query.payment_status, { field: 'payment_status', min: 2, max: 20 }),
    ticket_status: normalizeOptionalString(query.ticket_status, { field: 'ticket_status', min: 2, max: 20 }),
    booking_status: normalizeOptionalString(query.booking_status, { field: 'booking_status', min: 2, max: 20 }),
    agent_id: normalizeOptionalUuidish(query.agent_id, 'agent_id'),
    export_format: normalizeOptionalString(query.export_format, { field: 'export_format', min: 2, max: 10 })
  };

  const filtered = bookings.filter((booking) => {
    if (filters.booking_no && !booking.booking_no.includes(filters.booking_no)) return false;
    if (filters.passenger_name && !(booking.passengers || []).some((passenger) =>
      passenger.full_name.toLowerCase().includes(filters.passenger_name.toLowerCase())
    )) return false;
    if (filters.phone && !(booking.contact_phone || '').includes(filters.phone)) return false;
    if (filters.trip_date && booking.schedules?.trip_date !== filters.trip_date) return false;
    if (filters.schedule_id && booking.schedule_id !== filters.schedule_id) return false;
    if (filters.payment_status && !(booking.payments || []).some((payment) => payment.status === filters.payment_status)) return false;
    if (filters.ticket_status && !(booking.tickets || []).some((ticket) => ticket.status === filters.ticket_status)) return false;
    if (filters.booking_status && booking.booking_status !== filters.booking_status) return false;
    if (filters.agent_id && booking.agent_id !== filters.agent_id) return false;
    return true;
  });

  const paged = paginate(filtered, query.page, query.limit);
  const response = {
    ...paged
  };

  if (filters.export_format === 'csv') {
    response.export = {
      format: 'csv',
      content: buildCsvExport(filtered.map(flattenBookingForCsv), [
        { label: 'Booking No', get: (row) => row.booking_no },
        { label: 'Status', get: (row) => row.booking_status },
        { label: 'Trip Date', get: (row) => row.trip_date },
        { label: 'Schedule', get: (row) => row.schedule_code },
        { label: 'Route', get: (row) => row.route_name },
        { label: 'Contact', get: (row) => row.contact_name },
        { label: 'Phone', get: (row) => row.contact_phone },
        { label: 'Email', get: (row) => row.contact_email },
        { label: 'Passengers', get: (row) => row.total_passengers },
        { label: 'Amount', get: (row) => row.total_amount },
        { label: 'Payment Status', get: (row) => row.payment_status },
        { label: 'Ticket Status', get: (row) => row.ticket_status },
        { label: 'Source', get: (row) => row.source_channel },
        { label: 'Agent', get: (row) => row.agent_name },
        { label: 'Created At', get: (row) => row.created_at }
      ])
    };
  }

  return response;
};

export const getAdminBookingDetail = async (bookingNo) => {
  const booking = await getBookingByRef(bookingNo);
  const ticketIds = (booking.tickets || []).map((ticket) => ticket.id);

  const [{ data: auditLogs, error: auditError }, { data: notifications, error: notificationError }, { data: gateLogs, error: gateError }] = await Promise.all([
    supabase.from('audit_logs').select('*').eq('booking_id', booking.id).order('created_at', { ascending: false }),
    supabase.from('notifications').select('*').eq('booking_id', booking.id).order('created_at', { ascending: false }),
    ticketIds.length > 0
      ? supabase.from('gate_logs').select('*').in('ticket_id', ticketIds).order('scan_time', { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ]);

  throwIfError(auditError);
  throwIfError(notificationError);
  throwIfError(gateError);

  const timeline = sortByDateDesc([
    ...(auditLogs || []).map((item) => ({
      type: 'audit',
      created_at: item.created_at,
      detail: item
    })),
    ...(notifications || []).map((item) => ({
      type: 'notification',
      created_at: item.created_at,
      detail: item
    })),
    ...(gateLogs || []).map((item) => ({
      type: 'gate',
      created_at: item.scan_time,
      detail: item
    })),
    ...(booking.payments || []).map((item) => ({
      type: 'payment',
      created_at: item.updated_at || item.created_at,
      detail: item
    }))
  ], (item) => item.created_at);

  return {
    ...booking,
    audit_logs: auditLogs || [],
    notifications: notifications || [],
    gate_logs: gateLogs || [],
    timeline,
    print_payload: {
      booking_no: booking.booking_no,
      contact_name: booking.contact_name,
      trip_date: booking.schedules?.trip_date,
      departure_time: booking.schedules?.departure_time,
      route_name: booking.schedules?.route_name,
      tickets: booking.tickets || []
    }
  };
};

export const updateAdminBooking = async (bookingNo, payload, admin) => {
  const booking = await getBookingByRef(bookingNo);
  const oldValues = {
    contact_name: booking.contact_name,
    contact_phone: booking.contact_phone,
    contact_email: booking.contact_email,
    notes: booking.notes,
    passengers: booking.passengers
  };

  await updateBookingContact(booking, payload, {
    requireContactEmail: false
  });

  if (payload.passengers) {
    await setBookingPassengers(booking, payload.passengers, {
      requireContactEmail: false
    });
  }

  const updated = await getBookingByRef(bookingNo);
  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'booking.updated',
    entityType: 'booking',
    entityId: updated.booking_no,
    bookingId: updated.id,
    oldValues,
    newValues: {
      contact_name: updated.contact_name,
      contact_phone: updated.contact_phone,
      contact_email: updated.contact_email,
      notes: updated.notes,
      passengers: updated.passengers
    }
  });
  return updated;
};

export const changeBookingSchedule = async (bookingNo, payload, admin) => {
  const booking = await getBookingByRef(bookingNo);
  ensureBookingTicketsNotUsed(booking);
  const nextScheduleId = normalizeUuidish(payload.schedule_id, 'schedule_id');
  assert(booking.schedule_id !== nextScheduleId, 'New schedule must be different', 409);

  await reserveSeats(nextScheduleId, booking.total_passengers);
  try {
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        schedule_id: nextScheduleId,
        rescheduled_from_schedule_id: booking.schedule_id
      })
      .eq('id', booking.id);
    throwIfError(bookingError);

    const { error: ticketError } = await supabase
      .from('tickets')
      .update({ schedule_id: nextScheduleId })
      .eq('booking_id', booking.id);
    throwIfError(ticketError);

    await releaseSeats(booking.schedule_id, booking.total_passengers);
    await recalculateScheduleAvailability(booking.schedule_id);
    await recalculateScheduleAvailability(nextScheduleId);
  } catch (error) {
    await releaseSeats(nextScheduleId, booking.total_passengers);
    throw error;
  }

  const updated = await getBookingByRef(bookingNo);
  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'booking.rescheduled',
    entityType: 'booking',
    entityId: updated.booking_no,
    bookingId: updated.id,
    oldValues: { schedule_id: booking.schedule_id },
    newValues: { schedule_id: nextScheduleId }
  });
  return updated;
};

export const cancelBooking = async (bookingNo, payload, admin) => {
  const booking = await getBookingByRef(bookingNo);
  assert(!['cancelled', 'expired'].includes(booking.booking_status), 'Booking is already closed', 409);
  ensureBookingTicketsNotUsed(booking);

  const reason = normalizeOptionalString(payload.reason, { field: 'reason', max: 255 }) || 'admin_cancelled';
  const now = new Date().toISOString();

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({
      booking_status: 'cancelled',
      cancelled_at: now,
      cancel_reason: reason
    })
    .eq('id', booking.id);
  throwIfError(bookingError);

  await cancelActiveTickets(booking.id);
  await releaseSeats(booking.schedule_id, booking.total_passengers);
  await recalculateScheduleAvailability(booking.schedule_id);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'booking.cancelled',
    entityType: 'booking',
    entityId: booking.booking_no,
    bookingId: booking.id,
    oldValues: { booking_status: booking.booking_status },
    newValues: { booking_status: 'cancelled', cancel_reason: reason }
  });

  await createNotification({
    bookingId: booking.id,
    adminUserId: admin.id,
    type: 'warning',
    priority: 'high',
    subject: `Booking ${booking.booking_no} cancelled`,
    message: `Booking ${booking.booking_no} has been cancelled`,
    targetPath: `/admin/bookings/${booking.booking_no}`
  });

  if (normalizeBoolean(payload.refund, 'refund', false)) {
    const successPayment = (booking.payments || []).find((payment) => payment.status === 'success');
    if (successPayment) {
      await refundPaymentRecord(successPayment.payment_ref, {
        refund_reason: reason
      }, admin);
    }
  }

  return getBookingByRef(bookingNo);
};

export const markBookingPaid = async (bookingNo, payload, admin) => {
  const booking = await getBookingByRef(bookingNo);
  assert(!['cancelled', 'expired'].includes(booking.booking_status), 'Booking cannot be paid', 409);

  const paymentMethod = normalizeString(payload.payment_method || 'cash', {
    field: 'payment_method',
    min: 2,
    max: 30
  });
  assert(PAYMENT_METHODS.includes(paymentMethod), 'payment_method is invalid');

  const amount = payload.amount === undefined || payload.amount === null
    ? Number(booking.total_amount)
    : normalizeNonNegativeNumber(payload.amount, 'amount');
  assert(amount === Number(booking.total_amount), 'amount must equal booking total', 409);

  const now = new Date().toISOString();
  const existingSuccess = (booking.payments || []).find((payment) => payment.status === 'success');
  if (existingSuccess) {
    return getAdminPaymentDetail(existingSuccess.payment_ref);
  }

  let payment = (booking.payments || []).find((item) => item.status === 'pending');
  if (!payment) {
    const { data, error } = await supabase
      .from('payments')
      .insert([{
        booking_id: booking.id,
        payment_ref: generatePaymentRef(),
        payment_method: paymentMethod,
        gateway_name: 'admin_manual',
        amount,
        status: 'pending'
      }])
      .select('*')
      .single();

    throwIfError(error);
    payment = data;
  }

  const updatePayload = {
    status: 'success',
    paid_at: now,
    transaction_id: normalizeOptionalString(payload.transaction_id, { field: 'transaction_id', max: 120 }),
    reference_no: normalizeOptionalString(payload.reference_no, { field: 'reference_no', max: 120 }),
    payment_method: paymentMethod,
    proof_url: normalizeOptionalString(payload.proof_url, { field: 'proof_url', max: 255 }),
    confirmed_by_admin_id: admin.id,
    raw_response_json: {
      source: 'admin_manual',
      confirmed_at: now
    }
  };

  const { error: paymentError } = await supabase
    .from('payments')
    .update(updatePayload)
    .eq('id', payment.id);
  throwIfError(paymentError);

  await confirmBooking(booking.id);
  if ((booking.tickets || []).length === 0) {
    await issueTicketsForBooking(booking.id);
  }

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'booking.mark_paid',
    entityType: 'booking',
    entityId: booking.booking_no,
    bookingId: booking.id,
    oldValues: { payment_status: booking.payments || [] },
    newValues: { payment_ref: payment.payment_ref, payment_method: paymentMethod, amount }
  });

  await createNotification({
    bookingId: booking.id,
    adminUserId: admin.id,
    type: 'success',
    priority: 'normal',
    subject: `Payment confirmed for ${booking.booking_no}`,
    message: `Payment ${payment.payment_ref} confirmed successfully`,
    targetPath: `/admin/bookings/${booking.booking_no}`
  });

  return getAdminPaymentDetail(payment.payment_ref);
};

export const resendBookingTicketsAdmin = async (bookingNo, admin) => {
  const tickets = await resendTickets(bookingNo);
  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'ticket.resend',
    entityType: 'booking',
    entityId: bookingNo,
    bookingId: tickets[0]?.booking_id || null,
    metadata: { ticket_count: tickets.length }
  });
  return tickets;
};

export const refundBooking = async (bookingNo, payload, admin) => {
  const booking = await getBookingByRef(bookingNo);
  const successPayment = (booking.payments || []).find((payment) => payment.status === 'success');
  assert(successPayment, 'No successful payment found', 404);
  return refundPaymentRecord(successPayment.payment_ref, payload, admin);
};

export const createWalkInSale = async (payload, admin) => {
  assertNonEmptyArray(payload.items, 'items');
  assertNonEmptyArray(payload.passengers, 'passengers');

  const booking = await createBookingDraft({
    schedule_id: payload.schedule_id,
    agent_id: payload.agent_id || null,
    source_channel: payload.source_channel || 'counter',
    items: payload.items
  });

  const bookingRecord = await getBookingByRef(booking.booking_no);
  await updateBookingContact(bookingRecord, {
    contact_name: payload.contact_name || 'Walk-in Customer',
    contact_phone: payload.contact_phone || null,
    contact_email: payload.contact_email || null,
    notes: payload.notes || null
  });
  await setBookingPassengers(bookingRecord, payload.passengers, {
    requireContactEmail: false
  });

  let payment = null;
  if (normalizeBoolean(payload.mark_paid ?? true, 'mark_paid', true)) {
    payment = await markBookingPaid(booking.booking_no, {
      payment_method: payload.payment_method || 'cash',
      transaction_id: payload.transaction_id || null,
      reference_no: payload.reference_no || null,
      proof_url: payload.proof_url || null,
      amount: booking.total_amount
    }, admin);
  }

  return {
    booking: await getBookingByRef(booking.booking_no),
    payment
  };
};

export const searchTickets = async (query = {}) => {
  const term = normalizeOptionalString(query.q, { field: 'q', min: 2, max: 120 });
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      passengers(*),
      bookings!inner(booking_no, contact_name, contact_phone, booking_status, payments(*)),
      schedules(*),
      ticket_types(*)
    `)
    .order('created_at', { ascending: false });

  throwIfError(error);

  if (!term) return data || [];
  const normalized = term.toLowerCase();
  return (data || []).filter((ticket) =>
    (ticket.ticket_no || '').toLowerCase().includes(normalized) ||
    (ticket.qr_token || '').toLowerCase().includes(normalized) ||
    (ticket.bookings?.booking_no || '').toLowerCase().includes(normalized) ||
    (ticket.passengers?.full_name || '').toLowerCase().includes(normalized) ||
    (ticket.bookings?.contact_phone || '').toLowerCase().includes(normalized)
  );
};

export const scanTicket = async (payload, admin) => {
  const today = normalizeDateString(payload.trip_date, 'trip_date', { required: false }) || localDate();
  const searchTerm = normalizeOptionalString(payload.qr_token, { field: 'qr_token', min: 3, max: 120 })
    || normalizeOptionalString(payload.ticket_no, { field: 'ticket_no', min: 3, max: 120 })
    || normalizeOptionalString(payload.booking_no, { field: 'booking_no', min: 3, max: 120 });

  assert(searchTerm, 'qr_token, ticket_no, or booking_no is required');

  const tickets = await searchTickets({ q: searchTerm });
  const ticket = tickets.find((item) =>
    item.qr_token === searchTerm || item.ticket_no === searchTerm || item.bookings?.booking_no === searchTerm
  ) || tickets[0];
  assert(ticket, 'Ticket not found', 404);
  const booking = await getBookingByRef(ticket.bookings.booking_no);

  let result = 'deny';
  let reason = 'Ticket not found';
  let statusColor = 'red';

  const paymentSuccess = (booking.payments || []).some((payment) => payment.status === 'success');
  if (ticket.status !== 'active') {
    result = 'deny';
    reason = `Ticket status is ${ticket.status}`;
  } else if (booking.booking_status !== 'confirmed') {
    result = 'deny';
    reason = 'Booking not confirmed';
  } else if (!paymentSuccess) {
    result = 'deny';
    reason = 'Payment not completed';
  } else if (ticket.schedules?.trip_date !== today) {
    result = 'deny';
    reason = 'Ticket date does not match boarding date';
  } else if (payload.schedule_id && ticket.schedule_id !== normalizeUuidish(payload.schedule_id, 'schedule_id')) {
    result = 'deny';
    reason = 'Ticket does not match selected schedule';
  } else {
    result = 'allow';
    reason = 'Valid ticket';
    statusColor = 'green';

    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        boarded_at: new Date().toISOString()
      })
      .eq('id', ticket.id);
    throwIfError(updateError);
  }

  const { error: gateLogError } = await supabase
    .from('gate_logs')
    .insert([{
      ticket_id: ticket.id,
      admin_user_id: admin.id,
      scan_time: new Date().toISOString(),
      gate_code: normalizeOptionalString(payload.gate_code, { field: 'gate_code', min: 2, max: 40 }) || 'GATE-A',
      device_code: normalizeOptionalString(payload.device_code, { field: 'device_code', min: 2, max: 40 }) || 'ADMIN-SCANNER',
      result,
      reason
    }]);
  throwIfError(gateLogError);

  return {
    result,
    reason,
    status_color: statusColor,
    passenger_name: ticket.passengers?.full_name || null,
    schedule: ticket.schedules,
    ticket
  };
};

export const listAdminPayments = async (query = {}) => {
  const payments = await loadPayments();
  const filters = {
    date_from: normalizeDateString(query.date_from, 'date_from', { required: false }),
    date_to: normalizeDateString(query.date_to, 'date_to', { required: false }),
    status: normalizeOptionalString(query.status, { field: 'status', min: 2, max: 20 }),
    payment_method: normalizeOptionalString(query.payment_method, { field: 'payment_method', min: 2, max: 30 }),
    booking_no: normalizeOptionalString(query.booking_no, { field: 'booking_no', min: 3, max: 40 }),
    export_format: normalizeOptionalString(query.export_format, { field: 'export_format', min: 2, max: 10 })
  };

  const filtered = payments.filter((payment) => {
    const paymentDate = (payment.paid_at || payment.created_at || '').slice(0, 10);
    if (filters.date_from && paymentDate < filters.date_from) return false;
    if (filters.date_to && paymentDate > filters.date_to) return false;
    if (filters.status && payment.status !== filters.status) return false;
    if (filters.payment_method && payment.payment_method !== filters.payment_method) return false;
    if (filters.booking_no && payment.bookings?.booking_no !== filters.booking_no) return false;
    return true;
  });

  const paged = paginate(filtered, query.page, query.limit);
  if (filters.export_format === 'csv') {
    paged.export = {
      format: 'csv',
      content: buildCsvExport(filtered, [
        { label: 'Payment Ref', get: (row) => row.payment_ref },
        { label: 'Booking No', get: (row) => row.bookings?.booking_no || '' },
        { label: 'Date', get: (row) => row.paid_at || row.created_at },
        { label: 'Method', get: (row) => row.payment_method },
        { label: 'Amount', get: (row) => row.amount },
        { label: 'Status', get: (row) => row.status },
        { label: 'Reference No', get: (row) => row.reference_no || row.transaction_id || '' }
      ])
    };
  }

  return paged;
};

export const getAdminPaymentDetail = async (paymentRef) => {
  const normalizedPaymentRef = normalizeString(paymentRef, { field: 'payment_ref', min: 6, max: 32 });
  const { data, error } = await supabase
    .from('payments')
    .select(ADMIN_PAYMENT_SELECT)
    .eq('payment_ref', normalizedPaymentRef)
    .single();

  throwIfError(error, 'Payment not found', 404);
  return data;
};

export const confirmPaymentManually = async (paymentRef, payload, admin) => {
  const payment = await getAdminPaymentDetail(paymentRef);
  assert(payment.status === 'pending', 'Payment is already finalized', 409);
  const booking = payment.bookings;

  const amount = payload.amount === undefined || payload.amount === null
    ? Number(payment.amount)
    : normalizeNonNegativeNumber(payload.amount, 'amount');
  assert(amount === Number(payment.amount), 'amount mismatch', 409);

  const updatePayload = {
    status: 'success',
    paid_at: new Date().toISOString(),
    transaction_id: normalizeOptionalString(payload.transaction_id, { field: 'transaction_id', max: 120 }),
    reference_no: normalizeOptionalString(payload.reference_no, { field: 'reference_no', max: 120 }),
    proof_url: normalizeOptionalString(payload.proof_url, { field: 'proof_url', max: 255 }),
    confirmed_by_admin_id: admin.id
  };

  const { error } = await supabase
    .from('payments')
    .update(updatePayload)
    .eq('id', payment.id);
  throwIfError(error);

  await confirmBooking(booking.id);
  if ((booking.tickets || []).length === 0) {
    await issueTicketsForBooking(booking.id);
  }

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'payment.confirmed',
    entityType: 'payment',
    entityId: payment.payment_ref,
    bookingId: booking.id,
    oldValues: { status: payment.status },
    newValues: updatePayload
  });

  return getAdminPaymentDetail(payment.payment_ref);
};

export const refundPaymentManually = async (paymentRef, payload, admin) => refundPaymentRecord(paymentRef, payload, admin);

const groupByPeriod = (rows, field, mode = 'day') => {
  const map = new Map();
  for (const row of rows) {
    const rawDate = row[field];
    if (!rawDate) continue;
    const isoDate = String(rawDate).slice(0, 10);
    let key = isoDate;
    if (mode === 'month') key = isoDate.slice(0, 7);
    if (mode === 'year') key = isoDate.slice(0, 4);
    const current = map.get(key) || { period: key, amount: 0, count: 0 };
    current.amount += Number(row.amount || 0);
    current.count += 1;
    map.set(key, current);
  }
  return [...map.values()].sort((left, right) => left.period.localeCompare(right.period));
};

export const getSalesReport = async (query = {}) => {
  const payments = await loadPayments();
  const dateFrom = normalizeDateString(query.date_from, 'date_from', { required: false });
  const dateTo = normalizeDateString(query.date_to, 'date_to', { required: false });
  const mode = normalizeString(query.view || 'day', { field: 'view', min: 3, max: 10 });
  assert(['day', 'month', 'year'].includes(mode), 'view is invalid');

  const filtered = payments.filter((payment) => {
    const paymentDate = (payment.paid_at || payment.created_at || '').slice(0, 10);
    if (dateFrom && paymentDate < dateFrom) return false;
    if (dateTo && paymentDate > dateTo) return false;
    return ['success', 'refunded'].includes(payment.status);
  });

  const successful = filtered.filter((payment) => payment.status === 'success');
  const refunded = filtered.filter((payment) => payment.status === 'refunded');

  const ticketsSold = uniq(successful.map((payment) => payment.booking_id)).reduce((sum, bookingId) => {
    const payment = successful.find((item) => item.booking_id === bookingId);
    return sum + Number(payment?.bookings?.total_passengers || 0);
  }, 0);

  const paymentBreakdown = successful.reduce((map, payment) => {
    const key = payment.payment_method || 'unknown';
    map[key] = (map[key] || 0) + Number(payment.amount || 0);
    return map;
  }, {});

  const channelBreakdown = successful.reduce((map, payment) => {
    const key = payment.bookings?.source_channel || 'unknown';
    map[key] = (map[key] || 0) + Number(payment.amount || 0);
    return map;
  }, {});

  const agentBreakdown = successful.reduce((map, payment) => {
    const key = payment.bookings?.agents?.company_name || payment.bookings?.agents?.name || 'direct';
    map[key] = (map[key] || 0) + Number(payment.amount || 0);
    return map;
  }, {});

  const ticketTypeBreakdown = successful.reduce((map, payment) => {
    for (const item of payment.bookings?.booking_items || []) {
      const key = item.ticket_types?.name_th || item.ticket_type_id;
      map[key] = (map[key] || 0) + Number(item.total_price || 0);
    }
    return map;
  }, {});

  return {
    filters: { date_from: dateFrom, date_to: dateTo, view: mode },
    kpis: {
      gross_revenue: successful.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      refunded_amount: refunded.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      net_revenue: successful.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) - refunded.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      tickets_sold: ticketsSold
    },
    trend: groupByPeriod(successful, 'paid_at', mode),
    breakdowns: {
      payment_method: paymentBreakdown,
      source_channel: channelBreakdown,
      agent: agentBreakdown,
      ticket_type: ticketTypeBreakdown
    },
    table: successful.map((payment) => ({
      payment_ref: payment.payment_ref,
      booking_no: payment.bookings?.booking_no,
      paid_at: payment.paid_at,
      amount: payment.amount,
      payment_method: payment.payment_method,
      source_channel: payment.bookings?.source_channel || 'unknown',
      agent: payment.bookings?.agents?.company_name || payment.bookings?.agents?.name || 'direct'
    }))
  };
};

export const getPassengerReport = async (query = {}) => {
  const bookings = await loadBookings();
  const dateFrom = normalizeDateString(query.date_from, 'date_from', { required: false });
  const dateTo = normalizeDateString(query.date_to, 'date_to', { required: false });
  const scheduleId = normalizeOptionalUuidish(query.schedule_id, 'schedule_id');
  const ticketTypeId = normalizeOptionalUuidish(query.ticket_type_id, 'ticket_type_id');

  const filtered = bookings.filter((booking) => {
    const tripDate = booking.schedules?.trip_date || '';
    if (dateFrom && tripDate < dateFrom) return false;
    if (dateTo && tripDate > dateTo) return false;
    if (scheduleId && booking.schedule_id !== scheduleId) return false;
    if (ticketTypeId && !(booking.booking_items || []).some((item) => item.ticket_type_id === ticketTypeId)) return false;
    return booking.booking_status === 'confirmed';
  });

  const scheduleMap = {};
  const ticketTypeMap = {};
  let totalPassengers = 0;
  let totalCheckedIn = 0;

  for (const booking of filtered) {
    const scheduleKey = booking.schedule_id;
    if (!scheduleMap[scheduleKey]) {
      scheduleMap[scheduleKey] = {
        schedule_id: booking.schedule_id,
        schedule_code: booking.schedules?.schedule_code,
        trip_date: booking.schedules?.trip_date,
        departure_time: booking.schedules?.departure_time,
        route_name: booking.schedules?.route_name,
        capacity: booking.schedules?.capacity || 0,
        booked_passengers: 0,
        checked_in_passengers: 0
      };
    }

    scheduleMap[scheduleKey].booked_passengers += Number(booking.total_passengers || 0);
    const checkedIn = (booking.tickets || []).filter((ticket) => ticket.used_at).length;
    scheduleMap[scheduleKey].checked_in_passengers += checkedIn;
    totalPassengers += Number(booking.total_passengers || 0);
    totalCheckedIn += checkedIn;

    for (const item of booking.booking_items || []) {
      const key = item.ticket_types?.name_th || item.ticket_type_id;
      ticketTypeMap[key] = (ticketTypeMap[key] || 0) + Number(item.quantity || 0);
    }
  }

  const schedules = Object.values(scheduleMap).map((row) => ({
    ...row,
    load_factor: Number(row.capacity || 0) > 0
      ? Number(((row.booked_passengers / row.capacity) * 100).toFixed(2))
      : 0
  }));

  return {
    filters: { date_from: dateFrom, date_to: dateTo, schedule_id: scheduleId, ticket_type_id: ticketTypeId },
    summary: {
      total_passengers,
      checked_in_passengers: totalCheckedIn,
      booking_vs_boarding_gap: totalPassengers - totalCheckedIn
    },
    schedules,
    ticket_type_breakdown: ticketTypeMap,
    passenger_lists: filtered.map((booking) => ({
      booking_no: booking.booking_no,
      trip_date: booking.schedules?.trip_date,
      schedule_code: booking.schedules?.schedule_code,
      passengers: booking.passengers || []
    }))
  };
};

export const listAdminUsers = async (query = {}) => {
  const { data, error } = await supabase
    .from('admin_users')
    .select(ADMIN_USER_COLUMNS)
    .order('created_at', { ascending: false });
  throwIfError(error);

  const roleFilter = normalizeOptionalString(query.role, { field: 'role', min: 2, max: 50 });
  const statusFilter = normalizeOptionalString(query.status, { field: 'status', min: 2, max: 20 });

  const filtered = (data || []).filter((user) => {
    if (roleFilter && user.role !== roleFilter) return false;
    if (statusFilter && user.status !== statusFilter) return false;
    return true;
  });

  return paginate(filtered, query.page, query.limit);
};

export const createAdminUser = async (payload, admin) => {
  const role = await getRoleByCode(payload.role);
  assert(role, 'role is invalid');

  const password = normalizeString(payload.password, {
    field: 'password',
    min: env.minPasswordLength,
    max: 128,
    trim: false
  });

  const insertPayload = {
    name: normalizeString(payload.name, { field: 'name', min: 2, max: 120 }),
    username: normalizeOptionalString(payload.username, { field: 'username', min: 3, max: 120 }),
    phone: normalizePhone(payload.phone, { required: false }),
    email: normalizeEmail(payload.email),
    role: role.code,
    status: normalizeString(payload.status || 'active', { field: 'status', min: 2, max: 20 }),
    agent_id: normalizeOptionalUuidish(payload.agent_id, 'agent_id'),
    permissions_override: payload.permissions_override ? normalizeJsonArrayOfStrings(payload.permissions_override, 'permissions_override') : [],
    two_factor_enabled: normalizeBoolean(payload.two_factor_enabled, 'two_factor_enabled', false),
    two_factor_method: normalizeOptionalString(payload.two_factor_method, { field: 'two_factor_method', min: 3, max: 20 }),
    password: SUPABASE_AUTH_PLACEHOLDER
  };

  const authUser = await createAuthIdentity({
    email: insertPayload.email,
    password,
    scope: 'admin',
    metadata: {
      role: insertPayload.role
    }
  });
  assert(authUser, 'Email already exists', 409);
  insertPayload.auth_user_id = authUser.id;

  const { data, error } = await supabase
    .from('admin_users')
    .insert([insertPayload])
    .select(ADMIN_USER_COLUMNS)
    .single();
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'admin_user.created',
    entityType: 'admin_user',
    entityId: data.id,
    newValues: { ...insertPayload, password: '***' }
  });
  return data;
};

export const updateAdminUser = async (id, payload, admin) => {
  const existing = await getAdminUserById(id);
  const { data: existingAuthMeta, error: existingAuthError } = await supabase
    .from('admin_users')
    .select('id, email, role, auth_user_id')
    .eq('id', existing.id)
    .single();
  throwIfError(existingAuthError, 'Admin user not found', 404);

  if (payload.role !== undefined) {
    const role = await getRoleByCode(payload.role);
    assert(role, 'role is invalid');
  }

  const updatePayload = {};
  if (payload.name !== undefined) updatePayload.name = normalizeString(payload.name, { field: 'name', min: 2, max: 120 });
  if (payload.username !== undefined) updatePayload.username = normalizeOptionalString(payload.username, { field: 'username', min: 3, max: 120 });
  if (payload.phone !== undefined) updatePayload.phone = normalizePhone(payload.phone, { required: false });
  if (payload.email !== undefined) updatePayload.email = normalizeEmail(payload.email);
  if (payload.role !== undefined) updatePayload.role = normalizeString(payload.role, { field: 'role', min: 2, max: 50 });
  if (payload.status !== undefined) updatePayload.status = normalizeString(payload.status, { field: 'status', min: 2, max: 20 });
  if (payload.agent_id !== undefined) updatePayload.agent_id = normalizeOptionalUuidish(payload.agent_id, 'agent_id');
  if (payload.permissions_override !== undefined) updatePayload.permissions_override = normalizeJsonArrayOfStrings(payload.permissions_override, 'permissions_override');
  if (payload.two_factor_enabled !== undefined) updatePayload.two_factor_enabled = normalizeBoolean(payload.two_factor_enabled, 'two_factor_enabled', false);
  if (payload.two_factor_method !== undefined) updatePayload.two_factor_method = normalizeOptionalString(payload.two_factor_method, { field: 'two_factor_method', min: 3, max: 20 });

  const { data, error } = await supabase
    .from('admin_users')
    .update(updatePayload)
    .eq('id', existing.id)
    .select(ADMIN_USER_COLUMNS)
    .single();
  throwIfError(error);

  if (existingAuthMeta.auth_user_id && (updatePayload.email !== undefined || updatePayload.role !== undefined)) {
    await updateAuthIdentity(existingAuthMeta.auth_user_id, {
      ...(updatePayload.email !== undefined ? {
        email: updatePayload.email,
        email_confirm: true
      } : {}),
      user_metadata: {
        scope: 'admin',
        role: updatePayload.role || existingAuthMeta.role,
        local_admin_user_id: existing.id
      }
    });
  }

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'admin_user.updated',
    entityType: 'admin_user',
    entityId: existing.id,
    oldValues: existing,
    newValues: updatePayload
  });
  return data;
};

export const resetManagedAdminPassword = async (id, payload, admin) => {
  const target = await getAdminUserById(id);
  const { data: targetAuthMeta, error: targetAuthError } = await supabase
    .from('admin_users')
    .select('id, email, role, status, auth_user_id')
    .eq('id', target.id)
    .single();
  throwIfError(targetAuthError, 'Admin user not found', 404);

  const newPassword = normalizeOptionalString(payload.new_password, {
    field: 'new_password',
    min: env.minPasswordLength,
    max: 128
  }) || `Temp${nanoid(10)}`;

  await syncAdminAuthIdentity(targetAuthMeta, newPassword);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'admin_user.password_reset',
    entityType: 'admin_user',
    entityId: target.id
  });

  return {
    admin_user_id: target.id,
    temporary_password: newPassword
  };
};

export const listRoles = async () => {
  const { data, error } = await supabase
    .from('admin_roles')
    .select(ADMIN_ROLE_COLUMNS)
    .order('sort_order', { ascending: true });
  throwIfError(error);
  return {
    roles: data || [],
    permissions: ALL_PERMISSIONS
  };
};

export const createRole = async (payload, admin) => {
  const code = normalizeString(payload.code, { field: 'code', min: 2, max: 50 }).toLowerCase();
  const permissions = normalizeJsonArrayOfStrings(payload.permissions || [], 'permissions');
  for (const permission of permissions) {
    assert(ALL_PERMISSIONS.includes(permission) || permission === '*', `Unknown permission: ${permission}`);
  }

  const insertPayload = {
    code,
    name: normalizeString(payload.name, { field: 'name', min: 2, max: 120 }),
    description: normalizeOptionalString(payload.description, { field: 'description', max: 255 }),
    permissions,
    status: normalizeString(payload.status || 'active', { field: 'status', min: 2, max: 20 }),
    sort_order: payload.sort_order === undefined ? 0 : Number(payload.sort_order)
  };

  assert(Number.isInteger(insertPayload.sort_order), 'sort_order must be an integer');
  const { data, error } = await supabase
    .from('admin_roles')
    .insert([insertPayload])
    .select(ADMIN_ROLE_COLUMNS)
    .single();
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'role.created',
    entityType: 'admin_role',
    entityId: code,
    newValues: insertPayload
  });
  return data;
};

export const updateRole = async (code, payload, admin) => {
  const roleCode = normalizeString(code, { field: 'code', min: 2, max: 50 }).toLowerCase();
  const existing = await getRoleByCode(roleCode);
  assert(existing, 'Role not found', 404);

  const updatePayload = {};
  if (payload.name !== undefined) updatePayload.name = normalizeString(payload.name, { field: 'name', min: 2, max: 120 });
  if (payload.description !== undefined) updatePayload.description = normalizeOptionalString(payload.description, { field: 'description', max: 255 });
  if (payload.permissions !== undefined) {
    const permissions = normalizeJsonArrayOfStrings(payload.permissions, 'permissions');
    for (const permission of permissions) {
      assert(ALL_PERMISSIONS.includes(permission) || permission === '*', `Unknown permission: ${permission}`);
    }
    updatePayload.permissions = permissions;
  }
  if (payload.status !== undefined) updatePayload.status = normalizeString(payload.status, { field: 'status', min: 2, max: 20 });
  if (payload.sort_order !== undefined) {
    updatePayload.sort_order = Number(payload.sort_order);
    assert(Number.isInteger(updatePayload.sort_order), 'sort_order must be an integer');
  }

  const { data, error } = await supabase
    .from('admin_roles')
    .update(updatePayload)
    .eq('code', roleCode)
    .select(ADMIN_ROLE_COLUMNS)
    .single();
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'role.updated',
    entityType: 'admin_role',
    entityId: roleCode,
    oldValues: existing,
    newValues: updatePayload
  });
  return data;
};

export const listAgents = async (query = {}) => {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false });
  throwIfError(error);

  const status = normalizeOptionalString(query.status, { field: 'status', min: 2, max: 20 });
  const filtered = (data || []).filter((agent) => !status || agent.status === status);

  return paginate(filtered, query.page, query.limit);
};

export const createAgent = async (payload, admin) => {
  const insertPayload = {
    agent_code: normalizeOptionalString(payload.agent_code, { field: 'agent_code', min: 3, max: 30 }) || generateAgentCode(),
    name: normalizeString(payload.name, { field: 'name', min: 2, max: 120 }),
    company_name: normalizeOptionalString(payload.company_name, { field: 'company_name', max: 150 }),
    contact_name: normalizeOptionalString(payload.contact_name, { field: 'contact_name', max: 120 }),
    email: normalizeEmail(payload.email, { required: false }),
    phone: normalizePhone(payload.phone, { required: false }),
    payment_terms_days: payload.payment_terms_days === undefined ? 0 : Number(payload.payment_terms_days),
    credit_limit: payload.credit_limit === undefined ? 0 : normalizeNonNegativeNumber(payload.credit_limit, 'credit_limit'),
    status: normalizeString(payload.status || 'active', { field: 'status', min: 2, max: 20 }),
    contract_notes: normalizeOptionalString(payload.contract_notes, { field: 'contract_notes', max: 2000 }),
    address: normalizeOptionalString(payload.address, { field: 'address', max: 2000 }),
    metadata: payload.metadata || {}
  };
  assert(Number.isInteger(insertPayload.payment_terms_days) && insertPayload.payment_terms_days >= 0, 'payment_terms_days must be a non-negative integer');

  const { data, error } = await supabase
    .from('agents')
    .insert([insertPayload])
    .select('*')
    .single();
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'agent.created',
    entityType: 'agent',
    entityId: data.id,
    newValues: insertPayload
  });
  return data;
};

export const updateAgent = async (id, payload, admin) => {
  const agentId = normalizeUuidish(id, 'id');
  const { data: existing, error: existingError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();
  throwIfError(existingError, 'Agent not found', 404);

  const updatePayload = {};
  if (payload.agent_code !== undefined) updatePayload.agent_code = normalizeString(payload.agent_code, { field: 'agent_code', min: 3, max: 30 });
  if (payload.name !== undefined) updatePayload.name = normalizeString(payload.name, { field: 'name', min: 2, max: 120 });
  if (payload.company_name !== undefined) updatePayload.company_name = normalizeOptionalString(payload.company_name, { field: 'company_name', max: 150 });
  if (payload.contact_name !== undefined) updatePayload.contact_name = normalizeOptionalString(payload.contact_name, { field: 'contact_name', max: 120 });
  if (payload.email !== undefined) updatePayload.email = normalizeEmail(payload.email, { required: false });
  if (payload.phone !== undefined) updatePayload.phone = normalizePhone(payload.phone, { required: false });
  if (payload.payment_terms_days !== undefined) {
    updatePayload.payment_terms_days = Number(payload.payment_terms_days);
    assert(Number.isInteger(updatePayload.payment_terms_days) && updatePayload.payment_terms_days >= 0, 'payment_terms_days must be a non-negative integer');
  }
  if (payload.credit_limit !== undefined) updatePayload.credit_limit = normalizeNonNegativeNumber(payload.credit_limit, 'credit_limit');
  if (payload.status !== undefined) updatePayload.status = normalizeString(payload.status, { field: 'status', min: 2, max: 20 });
  if (payload.contract_notes !== undefined) updatePayload.contract_notes = normalizeOptionalString(payload.contract_notes, { field: 'contract_notes', max: 2000 });
  if (payload.address !== undefined) updatePayload.address = normalizeOptionalString(payload.address, { field: 'address', max: 2000 });
  if (payload.metadata !== undefined) updatePayload.metadata = payload.metadata || {};

  const { data, error } = await supabase
    .from('agents')
    .update(updatePayload)
    .eq('id', agentId)
    .select('*')
    .single();
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'agent.updated',
    entityType: 'agent',
    entityId: agentId,
    oldValues: existing,
    newValues: updatePayload
  });
  return data;
};

export const getAgentSalesSummary = async (id, query = {}) => {
  const agentId = normalizeUuidish(id, 'id');
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();
  throwIfError(agentError, 'Agent not found', 404);

  const bookings = await loadBookings();
  const dateFrom = normalizeDateString(query.date_from, 'date_from', { required: false });
  const dateTo = normalizeDateString(query.date_to, 'date_to', { required: false });

  const filtered = bookings.filter((booking) => {
    if (booking.agent_id !== agentId) return false;
    const tripDate = booking.schedules?.trip_date || '';
    if (dateFrom && tripDate < dateFrom) return false;
    if (dateTo && tripDate > dateTo) return false;
    return true;
  });

  const totalSales = filtered.reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0);
  const outstanding = filtered
    .filter((booking) => !(booking.payments || []).some((payment) => payment.status === 'success'))
    .reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0);

  return {
    agent,
    summary: {
      bookings: filtered.length,
      total_sales: totalSales,
      outstanding_balance: outstanding
    },
    bookings: filtered.map((booking) => ({
      booking_no: booking.booking_no,
      trip_date: booking.schedules?.trip_date,
      total_amount: booking.total_amount,
      booking_status: booking.booking_status,
      payment_statuses: (booking.payments || []).map((payment) => payment.status)
    }))
  };
};

export const listNotificationsCenter = async (query = {}) => {
  let builder = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  const type = normalizeOptionalString(query.type, { field: 'type', min: 2, max: 20 });
  const isRead = query.is_read === undefined ? null : normalizeBoolean(query.is_read, 'is_read', false);
  if (type) builder = builder.eq('type', type);
  if (isRead !== null) builder = builder.eq('is_read', isRead);

  const { data, error } = await builder;
  throwIfError(error);
  return paginate(data || [], query.page, query.limit);
};

export const createNotificationEntry = async (payload, admin) => {
  await createNotification({
    adminUserId: normalizeOptionalUuidish(payload.admin_user_id, 'admin_user_id'),
    bookingId: normalizeOptionalUuidish(payload.booking_id, 'booking_id'),
    ticketId: normalizeOptionalUuidish(payload.ticket_id, 'ticket_id'),
    userId: normalizeOptionalUuidish(payload.user_id, 'user_id'),
    type: normalizeString(payload.type || 'info', { field: 'type', min: 2, max: 20 }),
    priority: normalizeString(payload.priority || 'normal', { field: 'priority', min: 3, max: 20 }),
    subject: payload.subject,
    message: payload.message,
    targetPath: payload.target_path,
    metaJson: payload.meta_json || {}
  });

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'notification.created',
    entityType: 'notification',
    entityId: payload.subject || 'notification'
  });

  return { sent: true };
};

export const markNotificationRead = async (id, admin) => {
  const notificationId = normalizeUuidish(id, 'id');
  const { data, error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      admin_user_id: admin.id
    })
    .eq('id', notificationId)
    .select('*')
    .single();

  throwIfError(error, 'Notification not found', 404);
  return data;
};

export const listSystemSettings = async (query = {}) => {
  let builder = supabase
    .from('system_settings')
    .select('*')
    .order('category', { ascending: true })
    .order('key', { ascending: true });

  const category = normalizeOptionalString(query.category, { field: 'category', min: 2, max: 50 });
  if (category) builder = builder.eq('category', category);

  const { data, error } = await builder;
  throwIfError(error);

  const grouped = (data || []).reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return {
    items: data || [],
    grouped
  };
};

export const updateSystemSettings = async (payload, admin) => {
  assertNonEmptyArray(payload.items, 'items');

  const rows = payload.items.map((item, index) => ({
    category: normalizeString(item.category, { field: `items[${index}].category`, min: 2, max: 50 }),
    key: normalizeString(item.key, { field: `items[${index}].key`, min: 2, max: 80 }),
    value_json: item.value_json || {},
    description: normalizeOptionalString(item.description, { field: `items[${index}].description`, max: 255 }),
    is_public: normalizeBoolean(item.is_public, `items[${index}].is_public`, false),
    updated_by_admin_id: admin.id
  }));

  const { data, error } = await supabase
    .from('system_settings')
    .upsert(rows, { onConflict: 'category,key' })
    .select('*');
  throwIfError(error);

  await createAuditLog({
    adminUserId: admin.id,
    actorRole: admin.role,
    action: 'settings.updated',
    entityType: 'system_settings',
    entityId: 'bulk',
    newValues: rows
  });
  return data || [];
};

export const exportSystemSettings = async () => listSystemSettings({});

export const importSystemSettings = async (payload, admin) => updateSystemSettings(payload, admin);

export { listStandardPriceRules, listAgentPriceRules };
