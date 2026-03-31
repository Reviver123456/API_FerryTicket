import QRCode from 'qrcode';
import { supabase } from '../config/supabase.js';
import { generateTicketNo, generateScanCode } from '../utils/ids.js';
import { throwIfError, assert } from './base.service.js';
import { getBookingByRef } from './booking.service.js';
import { normalizeString } from '../utils/validation.js';

export const issueTicketsForBooking = async (bookingId) => {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      *,
      passengers(*),
      booking_items(*),
      tickets(*),
      schedules:schedules!bookings_schedule_id_fkey(*),
      rescheduled_from_schedule:schedules!bookings_rescheduled_from_schedule_id_fkey(*)
    `)
    .eq('id', bookingId)
    .single();

  throwIfError(bookingError);
  assert((booking.tickets || []).length === 0, 'Tickets already issued');
  assert((booking.passengers || []).length > 0, 'No passengers found for this booking');

  const ticketTypeId = booking.booking_items?.[0]?.ticket_type_id || null;
  const ticketRows = [];

  for (const passenger of booking.passengers) {
    const qr_token = generateScanCode();
    const qr_image = await QRCode.toDataURL(qr_token);
    ticketRows.push({
      ticket_no: generateTicketNo(),
      booking_id: booking.id,
      passenger_id: passenger.id,
      schedule_id: booking.schedule_id,
      ticket_type_id: ticketTypeId,
      qr_token,
      qr_image,
      status: 'active',
      issued_at: new Date().toISOString()
    });
  }

  const { data: inserted, error: ticketError } = await supabase
    .from('tickets')
    .insert(ticketRows)
    .select('*');

  throwIfError(ticketError);
  return inserted;
};

export const getTicketsByBookingNo = async (bookingNo) => {
  const normalizedBookingNo = normalizeString(bookingNo, { field: 'bookingNo', min: 6, max: 32 });
  const booking = await getBookingByRef(normalizedBookingNo);
  const hasSuccessfulPayment = (booking.payments || []).some((payment) => payment.status === 'success');

  if ((booking.tickets || []).length === 0 && booking.booking_status === 'confirmed' && hasSuccessfulPayment) {
    await issueTicketsForBooking(booking.id);
  }

  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      passengers(*),
      bookings!inner(booking_no, contact_name, contact_phone, contact_email, booking_status),
      schedules(*),
      ticket_types(*)
    `)
    .eq('bookings.booking_no', normalizedBookingNo);

  throwIfError(error);
  return data;
};

export const resendTickets = async (bookingNo) => {
  const tickets = await getTicketsByBookingNo(normalizeString(bookingNo, { field: 'booking_no', min: 6, max: 32 }));
  assert(tickets.length > 0, 'No tickets found');

  const { error } = await supabase
    .from('notifications')
    .insert([{
      booking_id: tickets[0].booking_id,
      ticket_id: tickets[0].id,
      channel: 'email',
      subject: `Resend tickets for ${bookingNo}`,
      message: 'E-ticket resent successfully',
      status: 'sent',
      sent_at: new Date().toISOString()
    }]);

  throwIfError(error);
  return tickets;
};
