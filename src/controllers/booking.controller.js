import { createBookingDraft, getBookingByRef, listBookingsForUser, updateBookingDetails, expireDraftBookings } from '../services/booking.service.js';
import { createHandler as handle } from '../utils/controller.js';
import { ok } from '../utils/http.js';
import { assert } from '../services/base.service.js';
import { normalizeEmail } from '../utils/validation.js';

const assertBookingAccess = (booking, contactEmail) => {
  if (!booking.contact_email) return;

  const normalizedContactEmail = normalizeEmail(contactEmail, { required: false });
  assert(normalizedContactEmail, 'contact_email is required', 403);
  assert(normalizedContactEmail === booking.contact_email.toLowerCase(), 'Booking access denied', 403);
};

export const createDraft = handle(createBookingDraft, 'Booking draft created', {
  status: 201,
  mapArgs: (req) => [{ ...req.body, user_id: req.user?.sub || null }]
});

export const show = async (req, res, next) => {
  try {
    const data = await getBookingByRef(req.params.bookingNo);
    assertBookingAccess(data, req.query.contact_email);
    return ok(res, data, 'Booking loaded');
  } catch (error) {
    next(error);
  }
};

export const mine = handle(listBookingsForUser, 'Bookings loaded', {
  mapArgs: (req) => [{
    user_id: req.user?.sub || null,
    user_email: req.user?.email || null
  }]
});

export const update = async (req, res, next) => {
  try {
    const booking = await getBookingByRef(req.params.bookingNo);
    assertBookingAccess(booking, req.body.contact_email);
    const data = await updateBookingDetails(req.params.bookingNo, req.body);
    return ok(res, data, 'Booking updated');
  } catch (error) {
    next(error);
  }
};

export const expireDrafts = handle(expireDraftBookings, 'Expired stale bookings', {
  mapArgs: () => []
});
