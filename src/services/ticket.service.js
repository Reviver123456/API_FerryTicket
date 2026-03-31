import QRCode from 'qrcode';
import { supabase } from '../config/supabase.js';
import { generateScanCode, generateTicketNo } from '../utils/ids.js';
import { assert, throwIfError } from './base.service.js';
import { assertBookingAccess, getBookingByRef, listBookings } from './booking.service.js';
import { hasPermission } from './access.service.js';
import { normalizeOptionalString, normalizeString } from '../utils/validation.js';

const TICKET_COLUMNS = 'id, ticket_no, booking_id, passenger_id, schedule_id, ticket_type_id, qr_token, qr_image, status, issued_at, used_at, created_at, updated_at';

const expandTicketTypeQueue = (items = []) => items.flatMap((item) => (
  Array.from({ length: Number(item.quantity || 0) }).map(() => item.ticket_type_id)
));

const loadTicketsByBookingId = async (bookingId) => {
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_COLUMNS)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  throwIfError(error);
  return data || [];
};

const getBookingNoById = async (bookingId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('booking_no')
    .eq('id', bookingId)
    .single();

  throwIfError(error, 'Booking not found', 404);
  return data.booking_no;
};

export const issueTicketsForBooking = async (bookingId) => {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, booking_no, schedule_id, passenger_count, payment_status, booking_status')
    .eq('id', bookingId)
    .single();

  throwIfError(bookingError, 'Booking not found', 404);
  assert(booking.payment_status === 'paid', 'Booking is not paid', 409);
  assert(booking.booking_status === 'confirmed', 'Booking is not confirmed', 409);

  const [{ data: passengers, error: passengerError }, { data: items, error: itemError }, existingTickets] = await Promise.all([
    supabase
      .from('booking_passengers')
      .select('id')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true }),
    supabase
      .from('booking_items')
      .select('ticket_type_id, quantity')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true }),
    loadTicketsByBookingId(bookingId)
  ]);

  throwIfError(passengerError);
  throwIfError(itemError);

  const activeTickets = (existingTickets || []).filter((ticket) => !['cancelled', 'refunded'].includes(ticket.status));
  if (activeTickets.length > 0) {
    return activeTickets;
  }

  const passengerRows = passengers || [];
  assert(passengerRows.length > 0, 'No passengers found for this booking', 409);
  assert(passengerRows.length === Number(booking.passenger_count), 'Passenger details are incomplete', 409);

  const ticketTypeQueue = expandTicketTypeQueue(items || []);
  assert(ticketTypeQueue.length === passengerRows.length, 'Ticket item summary is incomplete', 409);

  const ticketRows = [];
  for (const [index, passenger] of passengerRows.entries()) {
    const qr_token = generateScanCode();
    const qr_image = await QRCode.toDataURL(qr_token);
    ticketRows.push({
      ticket_no: generateTicketNo(),
      booking_id: booking.id,
      passenger_id: passenger.id,
      schedule_id: booking.schedule_id,
      ticket_type_id: ticketTypeQueue[index],
      qr_token,
      qr_image,
      status: 'unused',
      issued_at: new Date().toISOString()
    });
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert(ticketRows)
    .select(TICKET_COLUMNS);

  throwIfError(error);
  return data || [];
};

const getTicketsByBookingNo = async (bookingNo, actor = null, contactEmail = null) => {
  const booking = await getBookingByRef(bookingNo);
  assertBookingAccess(booking, actor, contactEmail);

  let tickets = await loadTicketsByBookingId(booking.id);
  const activeTickets = tickets.filter((ticket) => !['cancelled', 'refunded'].includes(ticket.status));

  if (activeTickets.length === 0 && booking.payment_status === 'paid' && booking.booking_status === 'confirmed') {
    tickets = await issueTicketsForBooking(booking.id);
  }

  return tickets;
};

export const listTickets = async (query = {}, actor) => {
  assert(actor, 'Unauthorized', 401);

  const bookingNo = normalizeOptionalString(query.bookingNo || query.booking_no, {
    field: 'bookingNo',
    min: 4,
    max: 32
  });
  const scheduleId = normalizeOptionalString(query.scheduleId || query.schedule_id, {
    field: 'scheduleId',
    min: 8,
    max: 64
  });
  const status = normalizeOptionalString(query.status, {
    field: 'status',
    min: 4,
    max: 20
  });

  let builder = supabase
    .from('tickets')
    .select(TICKET_COLUMNS)
    .order('created_at', { ascending: false });

  if (hasPermission(actor, 'tickets.view')) {
    if (scheduleId) builder = builder.eq('schedule_id', scheduleId);
    if (status) builder = builder.eq('status', status);

    const { data, error } = await builder;
    throwIfError(error);
    const tickets = data || [];

    if (!bookingNo) return tickets;

    const matchingBooking = await getBookingByRef(bookingNo);
    return tickets.filter((ticket) => ticket.booking_id === matchingBooking.id);
  }

  const bookings = await listBookings({}, actor);
  const bookingIds = bookings.map((booking) => booking.id);
  if (bookingIds.length === 0) return [];

  builder = builder.in('booking_id', bookingIds);
  if (scheduleId) builder = builder.eq('schedule_id', scheduleId);
  if (status) builder = builder.eq('status', status);

  const { data, error } = await builder;
  throwIfError(error);
  const tickets = data || [];

  if (!bookingNo) return tickets;
  const matchingBooking = bookings.find((booking) => booking.booking_no === bookingNo);
  return matchingBooking ? tickets.filter((ticket) => ticket.booking_id === matchingBooking.id) : [];
};

export const getTicketByNo = async (ticketNo, actor = null, contactEmail = null) => {
  const normalizedTicketNo = normalizeString(ticketNo, {
    field: 'ticketNo',
    min: 6,
    max: 32
  });
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_COLUMNS)
    .eq('ticket_no', normalizedTicketNo)
    .single();

  throwIfError(error, 'Ticket not found', 404);

  const bookingNo = await getBookingNoById(data.booking_id);
  const booking = await getBookingByRef(bookingNo);
  assertBookingAccess(booking, actor, contactEmail);
  return data;
};

export const resendTickets = async ({ booking_no, contact_email = null }, actor = null) => {
  const tickets = await getTicketsByBookingNo(
    normalizeString(booking_no, { field: 'booking_no', min: 6, max: 32 }),
    actor,
    contact_email
  );
  assert(tickets.length > 0, 'No tickets found', 404);

  const booking = await getBookingByRef(booking_no);
  const { error } = await supabase
    .from('notifications')
    .insert([{
      user_id: booking.user_id,
      booking_id: booking.id,
      ticket_id: tickets[0].id,
      created_by_user_id: actor?.id || null,
      channel: 'email',
      type: 'info',
      priority: 'normal',
      subject: `Resend tickets for ${booking_no}`,
      message: 'E-ticket resent successfully',
      status: 'sent',
      sent_at: new Date().toISOString()
    }]);

  throwIfError(error);
  return tickets;
};
