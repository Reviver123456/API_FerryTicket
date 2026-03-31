import { createBookingDraft, getBookingByRef, listBookingsForUser, updateBookingDetails, expireDraftBookings } from '../services/booking.service.js';
import { ok } from '../utils/http.js';
import { assert } from '../services/base.service.js';
import { normalizeEmail } from '../utils/validation.js';

const assertBookingAccess = (booking, contactEmail) => {
  if (!booking.contact_email) return;

  const normalizedContactEmail = normalizeEmail(contactEmail, { required: false });
  assert(normalizedContactEmail, 'contact_email is required', 403);
  assert(normalizedContactEmail === booking.contact_email.toLowerCase(), 'Booking access denied', 403);
};

export const createDraft = async (req, res, next) => {
  try {
    const payload = { ...req.body, user_id: req.user?.sub || null };
    const data = await createBookingDraft(payload);
    return ok(res, data, 'Booking draft created', 201);
  } catch (error) {
    next(error);
  }
};

export const show = async (req, res, next) => {
  try {
    const data = await getBookingByRef(req.params.bookingNo);
    assertBookingAccess(data, req.query.contact_email);
    return ok(res, data, 'Booking loaded');
  } catch (error) {
    next(error);
  }
};

export const mine = async (req, res, next) => {
  try {
    const data = await listBookingsForUser({
      user_id: req.user?.sub || null,
      user_email: req.user?.email || null
    });

    return ok(res, data, 'Bookings loaded');
  } catch (error) {
    next(error);
  }
};

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

export const expireDrafts = async (req, res, next) => {
  try {
    const data = await expireDraftBookings();
    return ok(res, data, 'Expired stale bookings');
  } catch (error) {
    next(error);
  }
};
