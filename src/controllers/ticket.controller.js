import { getTicketsByBookingNo, resendTickets } from '../services/ticket.service.js';
import { ok } from '../utils/http.js';
import { assert } from '../services/base.service.js';
import { normalizeEmail } from '../utils/validation.js';

export const byBooking = async (req, res, next) => {
  try {
    const data = await getTicketsByBookingNo(req.params.bookingNo);
    assert(data.length > 0, 'No tickets found', 404);

    const normalizedContactEmail = normalizeEmail(req.query.contact_email, { required: false });
    assert(normalizedContactEmail, 'contact_email is required', 403);
    assert(normalizedContactEmail === data[0].bookings.contact_email.toLowerCase(), 'Ticket access denied', 403);

    return ok(res, data, 'Tickets loaded');
  } catch (error) {
    next(error);
  }
};

export const resend = async (req, res, next) => {
  try {
    const data = await resendTickets(req.body.booking_no);
    return ok(res, data, 'Tickets resent');
  } catch (error) {
    next(error);
  }
};
