import { env } from '../config/env.js';
import { getBookingByRef } from '../services/booking.service.js';
import { handlePaymentWebhook } from '../services/payment.service.js';
import { getTicketsByBookingNo, resendTickets } from '../services/ticket.service.js';
import { ok } from '../utils/http.js';
import { assert } from '../services/base.service.js';
import { normalizeEmail } from '../utils/validation.js';

export const byBooking = async (req, res, next) => {
  try {
    const normalizedContactEmail = normalizeEmail(req.query.contact_email, { required: false });
    assert(normalizedContactEmail, 'contact_email is required', 403);

    let data = await getTicketsByBookingNo(req.params.bookingNo);

    if (data.length === 0 && env.mockPaymentAutoSuccess) {
      const booking = await getBookingByRef(req.params.bookingNo);
      assert(normalizedContactEmail === booking.contact_email?.toLowerCase(), 'Ticket access denied', 403);

      const pendingPayment = (booking.payments || []).find(
        (payment) => payment.status === 'pending' && payment.gateway_name === 'mock_gateway'
      );

      if (pendingPayment) {
        await handlePaymentWebhook({
          payment_ref: pendingPayment.payment_ref,
          status: 'success',
          transaction_id: pendingPayment.transaction_id || `AUTO-LOOKUP-${pendingPayment.payment_ref}`,
          amount: Number(pendingPayment.amount),
          raw: {
            auto_success: true,
            triggered_by: 'ticket_lookup',
            confirmed_at: new Date().toISOString()
          }
        });

        data = await getTicketsByBookingNo(req.params.bookingNo);
      }
    }

    assert(data.length > 0, 'No tickets found', 404);
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
