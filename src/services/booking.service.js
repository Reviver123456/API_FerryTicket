import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { generateBookingNo } from '../utils/ids.js';
import { addMinutesIso } from '../utils/date.js';
import { assert, throwIfError } from './base.service.js';
import { resolvePricePreview } from './price.service.js';
import { ensureScheduleAvailable, getScheduleById } from './schedule.service.js';
import { hasPermission } from './access.service.js';
import {
  assertNonEmptyArray,
  normalizeEmail,
  normalizeNonNegativeNumber,
  normalizeOptionalString,
  normalizeOptionalUuidish,
  normalizePhone,
  normalizePositiveInteger,
  normalizeString,
  normalizeUuidish
} from '../utils/validation.js';

const BOOKING_COLUMNS = 'id, booking_no, user_id, guest_email, guest_phone, contact_name, contact_email, contact_phone, schedule_id, ticket_type_summary, passenger_count, total_amount, payment_status, booking_status, hold_expired_at, source_channel, agent_id, created_by_user_id, updated_by_user_id, notes, cancelled_at, cancel_reason, rescheduled_from_schedule_id, created_at, updated_at';

const mergeRows = (...collections) => {
  const merged = collections.flat().filter(Boolean);
  return merged.filter(
    (row, index) => merged.findIndex((candidate) => candidate.id === row.id) === index
  );
};

const sortBookings = (bookings = []) => [...bookings].sort(
  (left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime()
);

const isPrivilegedBookingUser = (actor) => hasPermission(actor, 'bookings.view');

const isBookingOwner = (booking, actor = null, contactEmail = null) => {
  if (actor && isPrivilegedBookingUser(actor)) return true;
  if (actor?.id && booking.user_id && actor.id === booking.user_id) return true;

  const actorEmail = actor?.email ? actor.email.toLowerCase() : null;
  const normalizedContactEmail = contactEmail ? normalizeEmail(contactEmail, { required: false }) : null;
  const allowedEmails = [actorEmail, normalizedContactEmail].filter(Boolean);
  const bookingEmails = [
    booking.contact_email ? booking.contact_email.toLowerCase() : null,
    booking.guest_email ? booking.guest_email.toLowerCase() : null
  ].filter(Boolean);

  return allowedEmails.some((email) => bookingEmails.includes(email));
};

export const assertBookingAccess = (booking, actor = null, contactEmail = null) => {
  assert(isBookingOwner(booking, actor, contactEmail), 'Booking access denied', actor ? 403 : 401);
};

const buildTicketTypeSummary = (items = []) => items.map((item) => ({
  ticket_type_id: item.ticket_type_id,
  code: item.ticket_type?.code || null,
  name_th: item.ticket_type?.name_th || null,
  quantity: item.quantity,
  unit_price: Number(item.unit_price),
  total_price: Number(item.total_price)
}));

const loadBookingItems = async (bookingId) => {
  const { data, error } = await supabase
    .from('booking_items')
    .select('id, booking_id, ticket_type_id, quantity, unit_price, total_price, created_at, updated_at, ticket_type:ticket_types(id, code, name_th, name_en)')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  throwIfError(error);
  return data || [];
};

const loadBookingPassengersRows = async (bookingId) => {
  const { data, error } = await supabase
    .from('booking_passengers')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  throwIfError(error);
  return data || [];
};

const loadBookingPayments = async (bookingId) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });

  throwIfError(error);
  return data || [];
};

const loadBookingTickets = async (bookingId) => {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  throwIfError(error);
  return data || [];
};

const loadBookingSchedule = async (scheduleId) => {
  if (!scheduleId) return null;
  return getScheduleById(scheduleId);
};

const loadAgent = async (agentId) => {
  if (!agentId) return null;

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .maybeSingle();

  throwIfError(error);
  return data;
};

const hydrateBooking = async (booking) => {
  if (!booking) return null;

  const [items, passengers, payments, tickets, schedule, agent] = await Promise.all([
    loadBookingItems(booking.id),
    loadBookingPassengersRows(booking.id),
    loadBookingPayments(booking.id),
    loadBookingTickets(booking.id),
    loadBookingSchedule(booking.schedule_id),
    loadAgent(booking.agent_id)
  ]);

  return {
    ...booking,
    schedule,
    agent,
    items,
    passengers,
    payments,
    tickets,
    ticket_type_summary: booking.ticket_type_summary && Array.isArray(booking.ticket_type_summary)
      ? booking.ticket_type_summary
      : buildTicketTypeSummary(items)
  };
};

const updateBookingSummary = async (bookingId) => {
  const items = await loadBookingItems(bookingId);
  const passengerCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  const summary = buildTicketTypeSummary(items);

  const { error } = await supabase
    .from('bookings')
    .update({
      passenger_count: passengerCount,
      total_amount: totalAmount,
      ticket_type_summary: summary
    })
    .eq('id', bookingId);

  throwIfError(error);
};

const isBookingReadyForPayment = (booking, passengers = []) => {
  return Boolean(
    booking.contact_name
    && booking.contact_email
    && booking.contact_phone
    && passengers.length === Number(booking.passenger_count || 0)
  );
};

const updateBookingStatusAfterPassengerChange = async (booking) => {
  const passengers = await loadBookingPassengersRows(booking.id);
  const nextStatus = isBookingReadyForPayment(booking, passengers)
    ? (booking.booking_status === 'draft' ? 'pending_payment' : booking.booking_status)
    : booking.booking_status;

  if (nextStatus !== booking.booking_status) {
    const { error } = await supabase
      .from('bookings')
      .update({
        booking_status: nextStatus
      })
      .eq('id', booking.id);

    throwIfError(error);
  }
};

const getBookingRecordByNo = async (bookingNo) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('booking_no', normalizeString(bookingNo, { field: 'bookingNo', min: 6, max: 32 }))
    .single();

  throwIfError(error, 'Booking not found', 404);
  return data;
};

const loadBookingsForOwner = async (actor) => {
  assert(actor, 'Unauthorized', 401);

  const byUserId = [];
  const byContactEmail = [];
  const byGuestEmail = [];

  if (actor.id) {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('user_id', actor.id);

    throwIfError(error);
    byUserId.push(...(data || []));
  }

  if (actor.email) {
    const { data: contactData, error: contactError } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('contact_email', actor.email);
    throwIfError(contactError);
    byContactEmail.push(...(contactData || []));

    const { data: guestData, error: guestError } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('guest_email', actor.email);
    throwIfError(guestError);
    byGuestEmail.push(...(guestData || []));
  }

  return sortBookings(mergeRows(byUserId, byContactEmail, byGuestEmail));
};

export const createBookingDraft = async (payload = {}, actor = null) => {
  const scheduleId = normalizeUuidish(payload.schedule_id, 'schedule_id');
  const agentId = normalizeOptionalUuidish(payload.agent_id, 'agent_id');
  const sourceChannel = normalizeString(payload.source_channel || 'web', {
    field: 'source_channel',
    min: 2,
    max: 40
  });
  const guestEmail = normalizeEmail(payload.guest_email, { required: false });
  const guestPhone = normalizePhone(payload.guest_phone, { required: false });

  assertNonEmptyArray(payload.items, 'items');

  const normalizedItems = await Promise.all(payload.items.map(async (item, index) => {
    const ticketTypeId = normalizeUuidish(item.ticket_type_id, `items[${index}].ticket_type_id`);
    const quantity = normalizePositiveInteger(item.quantity, `items[${index}].quantity`);
    const manualUnitPrice = item.manual_unit_price === undefined || item.manual_unit_price === null || item.manual_unit_price === ''
      ? null
      : normalizeNonNegativeNumber(item.manual_unit_price, `items[${index}].manual_unit_price`);

    const pricing = manualUnitPrice === null
      ? await resolvePricePreview({
        ticket_type_id: ticketTypeId,
        agent_id: agentId
      })
      : { amount: manualUnitPrice, currency: 'THB' };

    return {
      ticket_type_id: ticketTypeId,
      quantity,
      unit_price: Number(pricing.amount),
      currency: pricing.currency || 'THB'
    };
  }));

  const passengerCount = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = normalizedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  await ensureScheduleAvailable(scheduleId, passengerCount);

  const { error: reserveError } = await supabase.rpc('reserve_schedule_seats', {
    p_schedule_id: scheduleId,
    p_seat_count: passengerCount
  });
  throwIfError(reserveError, 'Schedule is unavailable or has insufficient seats', 409);

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        booking_no: generateBookingNo(),
        user_id: actor?.id || null,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        schedule_id: scheduleId,
        passenger_count: passengerCount,
        total_amount: totalAmount,
        payment_status: 'unpaid',
        booking_status: 'draft',
        hold_expired_at: addMinutesIso(env.bookingHoldMinutes),
        source_channel: sourceChannel,
        agent_id: agentId,
        created_by_user_id: actor?.id || null,
        updated_by_user_id: actor?.id || null
      }])
      .select(BOOKING_COLUMNS)
      .single();

    throwIfError(bookingError);

    const bookingItemsPayload = normalizedItems.map((item) => ({
      booking_id: booking.id,
      ticket_type_id: item.ticket_type_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: Number(item.quantity) * Number(item.unit_price)
    }));

    const { error: itemsError } = await supabase
      .from('booking_items')
      .insert(bookingItemsPayload);

    throwIfError(itemsError);

    await updateBookingSummary(booking.id);
    return getBookingByRef(booking.booking_no);
  } catch (error) {
    await supabase.rpc('release_schedule_seats', {
      p_schedule_id: scheduleId,
      p_seat_count: passengerCount
    });
    throw error;
  }
};

export const listBookings = async (query = {}, actor) => {
  assert(actor, 'Unauthorized', 401);

  let bookings;
  if (isPrivilegedBookingUser(actor)) {
    let builder = supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .order('created_at', { ascending: false });

    const status = normalizeOptionalString(query.status, {
      field: 'status',
      min: 4,
      max: 30
    });
    const bookingNo = normalizeOptionalString(query.bookingNo || query.booking_no, {
      field: 'bookingNo',
      min: 4,
      max: 32
    });
    const dateFrom = normalizeDateString(query.dateFrom || query.date_from, 'dateFrom', { required: false });
    const dateTo = normalizeDateString(query.dateTo || query.date_to, 'dateTo', { required: false });
    const contactPhone = normalizePhone(query.contactPhone || query.contact_phone, { required: false });

    if (status) {
      builder = builder.or(`booking_status.eq.${status},payment_status.eq.${status}`);
    }
    if (bookingNo) builder = builder.ilike('booking_no', `%${bookingNo}%`);
    if (dateFrom) builder = builder.gte('created_at', `${dateFrom}T00:00:00.000Z`);
    if (dateTo) builder = builder.lte('created_at', `${dateTo}T23:59:59.999Z`);
    if (contactPhone) builder = builder.eq('contact_phone', contactPhone);

    const { data, error } = await builder;
    throwIfError(error);
    bookings = data || [];
  } else {
    bookings = await loadBookingsForOwner(actor);
  }

  return Promise.all(bookings.map(hydrateBooking));
};

export const getBookingByRef = async (bookingNo) => {
  const booking = await getBookingRecordByNo(bookingNo);
  return hydrateBooking(booking);
};

export const updateBookingDetails = async (bookingNo, payload = {}, actor = null, contactEmail = null) => {
  const booking = await getBookingRecordByNo(bookingNo);
  assertBookingAccess(booking, actor, contactEmail || payload.contact_email || payload.guest_email);
  assert(!['cancelled', 'expired', 'refunded'].includes(booking.booking_status), 'Booking cannot be updated', 409);

  const updatePayload = {
    updated_by_user_id: actor?.id || booking.updated_by_user_id || null
  };

  if (payload.contact_name !== undefined) {
    updatePayload.contact_name = normalizeString(payload.contact_name, {
      field: 'contact_name',
      min: 2,
      max: 120
    });
  }
  if (payload.contact_email !== undefined) {
    updatePayload.contact_email = normalizeEmail(payload.contact_email);
  }
  if (payload.contact_phone !== undefined) {
    updatePayload.contact_phone = normalizePhone(payload.contact_phone, { required: true });
  }
  if (payload.guest_email !== undefined) {
    updatePayload.guest_email = normalizeEmail(payload.guest_email, { required: false });
  }
  if (payload.guest_phone !== undefined) {
    updatePayload.guest_phone = normalizePhone(payload.guest_phone, { required: false });
  }
  if (payload.notes !== undefined) {
    updatePayload.notes = normalizeOptionalString(payload.notes, {
      field: 'notes',
      max: 500
    });
  }

  const { error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', booking.id);

  throwIfError(error);

  if (Array.isArray(payload.passengers)) {
    await replaceBookingPassengers(booking.booking_no, payload.passengers, actor, contactEmail || payload.contact_email);
  } else {
    await updateBookingStatusAfterPassengerChange({
      ...booking,
      ...updatePayload
    });
  }

  return getBookingByRef(booking.booking_no);
};

export const listBookingPassengers = async (bookingNo, actor = null, contactEmail = null) => {
  const booking = await getBookingRecordByNo(bookingNo);
  assertBookingAccess(booking, actor, contactEmail);
  return loadBookingPassengersRows(booking.id);
};

export const replaceBookingPassengers = async (bookingNo, passengers = [], actor = null, contactEmail = null) => {
  const booking = await getBookingRecordByNo(bookingNo);
  assertBookingAccess(booking, actor, contactEmail);
  assert(!['cancelled', 'expired', 'refunded'].includes(booking.booking_status), 'Booking passengers cannot be updated', 409);
  assertNonEmptyArray(passengers, 'passengers');
  assert(passengers.length === Number(booking.passenger_count), 'Passenger count must match reserved seats', 409);

  const { error: deleteError } = await supabase
    .from('booking_passengers')
    .delete()
    .eq('booking_id', booking.id);

  throwIfError(deleteError);

  const rows = passengers.map((passenger, index) => ({
    booking_id: booking.id,
    full_name: normalizeString(passenger.full_name, {
      field: `passengers[${index}].full_name`,
      min: 2,
      max: 120
    }),
    passenger_type: normalizeString(passenger.passenger_type || 'adult', {
      field: `passengers[${index}].passenger_type`,
      min: 2,
      max: 20
    }),
    seat_no: normalizeOptionalString(passenger.seat_no, {
      field: `passengers[${index}].seat_no`,
      max: 20
    }),
    remark: normalizeOptionalString(passenger.remark, {
      field: `passengers[${index}].remark`,
      max: 255
    })
  }));

  const { error: insertError } = await supabase
    .from('booking_passengers')
    .insert(rows);

  throwIfError(insertError);

  await updateBookingStatusAfterPassengerChange(booking);
  return loadBookingPassengersRows(booking.id);
};

export const cancelBooking = async (bookingNo, payload = {}, actor = null, contactEmail = null) => {
  const booking = await getBookingRecordByNo(bookingNo);
  assertBookingAccess(booking, actor, contactEmail || payload.contact_email);
  assert(!['cancelled', 'expired', 'refunded'].includes(booking.booking_status), 'Booking is already closed', 409);

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({
      booking_status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: normalizeOptionalString(payload.reason || payload.cancel_reason, {
        field: 'reason',
        max: 255
      }),
      updated_by_user_id: actor?.id || booking.updated_by_user_id || null
    })
    .eq('id', booking.id);

  throwIfError(bookingError);

  await supabase.rpc('release_schedule_seats', {
    p_schedule_id: booking.schedule_id,
    p_seat_count: Number(booking.passenger_count)
  });

  const { error: ticketError } = await supabase
    .from('tickets')
    .update({
      status: 'cancelled'
    })
    .eq('booking_id', booking.id)
    .neq('status', 'refunded');

  throwIfError(ticketError);
  return getBookingByRef(booking.booking_no);
};

export const changeBookingSchedule = async (bookingNo, payload = {}, actor = null, contactEmail = null) => {
  const booking = await getBookingRecordByNo(bookingNo);
  assertBookingAccess(booking, actor, contactEmail || payload.contact_email);
  assert(!['cancelled', 'expired', 'refunded'].includes(booking.booking_status), 'Booking cannot be changed', 409);

  const nextScheduleId = normalizeUuidish(payload.schedule_id || payload.new_schedule_id, 'schedule_id');
  assert(nextScheduleId !== booking.schedule_id, 'schedule_id must be different from current schedule');

  await ensureScheduleAvailable(nextScheduleId, Number(booking.passenger_count));

  const { error: reserveError } = await supabase.rpc('reserve_schedule_seats', {
    p_schedule_id: nextScheduleId,
    p_seat_count: Number(booking.passenger_count)
  });
  throwIfError(reserveError, 'Schedule is unavailable or has insufficient seats', 409);

  try {
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        schedule_id: nextScheduleId,
        rescheduled_from_schedule_id: booking.schedule_id,
        updated_by_user_id: actor?.id || booking.updated_by_user_id || null
      })
      .eq('id', booking.id);

    throwIfError(updateError);

    await supabase.rpc('release_schedule_seats', {
      p_schedule_id: booking.schedule_id,
      p_seat_count: Number(booking.passenger_count)
    });

    const { error: ticketError } = await supabase
      .from('tickets')
      .update({
        status: 'cancelled'
      })
      .eq('booking_id', booking.id)
      .eq('status', 'unused');

    throwIfError(ticketError);

    return getBookingByRef(booking.booking_no);
  } catch (error) {
    await supabase.rpc('release_schedule_seats', {
      p_schedule_id: nextScheduleId,
      p_seat_count: Number(booking.passenger_count)
    });
    throw error;
  }
};

export const setBookingAsPaid = async (bookingId) => {
  const { error } = await supabase
    .from('bookings')
    .update({
      payment_status: 'paid',
      booking_status: 'confirmed'
    })
    .eq('id', bookingId);

  throwIfError(error);
};

export const setBookingAsRefunded = async (bookingId) => {
  const { error } = await supabase
    .from('bookings')
    .update({
      payment_status: 'refunded',
      booking_status: 'refunded'
    })
    .eq('id', bookingId);

  throwIfError(error);
};

export const setBookingPaymentPending = async (bookingId) => {
  const { error } = await supabase
    .from('bookings')
    .update({
      payment_status: 'pending',
      booking_status: 'pending_payment'
    })
    .eq('id', bookingId);

  throwIfError(error);
};

export const expireDraftBookings = async () => {
  const { data, error } = await supabase.rpc('expire_stale_bookings');
  throwIfError(error, 'Failed to expire stale bookings');
  return data || [];
};
