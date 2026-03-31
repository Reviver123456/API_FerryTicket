import {
  assertBookingAccess,
  cancelBooking,
  changeBookingSchedule,
  createBookingDraft,
  expireDraftBookings,
  getBookingByRef,
  listBookingPassengers,
  listBookings,
  replaceBookingPassengers,
  updateBookingDetails
} from '../services/booking.service.js';
import { markBookingPaid, refundBookingPayment } from '../services/payment.service.js';
import { resendTickets } from '../services/ticket.service.js';
import { createHandler as handle } from '../utils/controller.js';
import { ok } from '../utils/http.js';

export const createDraft = handle(createBookingDraft, 'Booking draft created', {
  status: 201,
  mapArgs: (req) => [req.body, req.user || null]
});

export const index = handle(listBookings, 'Bookings loaded', {
  mapArgs: (req) => [req.query, req.user]
});

export const show = async (req, res, next) => {
  try {
    const data = await getBookingByRef(req.params.bookingNo);
    assertBookingAccess(data, req.user || null, req.query.contact_email || null);
    return ok(res, data, 'Booking loaded');
  } catch (error) {
    next(error);
  }
};

export const update = handle(updateBookingDetails, 'Booking updated', {
  mapArgs: (req) => [
    req.params.bookingNo,
    req.body,
    req.user || null,
    req.query.contact_email || req.body.contact_email || null
  ]
});

export const passengers = handle(listBookingPassengers, 'Passengers loaded', {
  mapArgs: (req) => [
    req.params.bookingNo,
    req.user || null,
    req.query.contact_email || null
  ]
});

export const passengersReplace = handle(replaceBookingPassengers, 'Passengers updated', {
  mapArgs: (req) => [
    req.params.bookingNo,
    Array.isArray(req.body) ? req.body : req.body.passengers,
    req.user || null,
    req.query.contact_email || req.body.contact_email || null
  ]
});

export const cancel = handle(cancelBooking, 'Booking cancelled', {
  mapArgs: (req) => [
    req.params.bookingNo,
    req.body,
    req.user || null,
    req.query.contact_email || req.body.contact_email || null
  ]
});

export const changeSchedule = handle(changeBookingSchedule, 'Booking schedule changed', {
  mapArgs: (req) => [
    req.params.bookingNo,
    req.body,
    req.user || null,
    req.query.contact_email || req.body.contact_email || null
  ]
});

export const markPaid = handle(markBookingPaid, 'Booking payment confirmed', {
  mapArgs: (req) => [req.params.bookingNo, req.body, req.user]
});

export const resend = handle(resendTickets, 'Tickets resent', {
  mapArgs: (req) => [{
    booking_no: req.params.bookingNo,
    contact_email: req.query.contact_email || req.body.contact_email || null
  }, req.user || null]
});

export const refund = handle(refundBookingPayment, 'Booking refunded', {
  mapArgs: (req) => [req.params.bookingNo, req.body, req.user]
});

export const expireDrafts = handle(expireDraftBookings, 'Expired stale bookings', {
  mapArgs: () => []
});
