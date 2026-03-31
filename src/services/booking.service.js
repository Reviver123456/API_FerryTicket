import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { generateBookingNo } from '../utils/ids.js';
import { addMinutesIso, isExpired } from '../utils/date.js';
import { throwIfError, assert } from './base.service.js';
import {
  assertNonEmptyArray,
  normalizeEmail,
  normalizeNonNegativeNumber,
  normalizeOptionalString,
  normalizePhone,
  normalizePositiveInteger,
  normalizeString,
  normalizeUuidish
} from '../utils/validation.js';

const calculateTotals = (items = []) => {
  const total_passengers = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const total_amount = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
  return { total_passengers, total_amount };
};

const BOOKING_WITH_RELATIONS_SELECT = `
  *,
  schedules(*),
  booking_items(*, ticket_types(*)),
  passengers(*),
  payments(*),
  tickets(*)
`;

const sortBookings = (bookings = []) =>
  [...bookings].sort(
    (left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime()
  );

const mergeBookings = (...collections) => {
  const merged = collections.flat().filter(Boolean);

  return merged.filter(
    (booking, index) => merged.findIndex((candidate) => candidate.id === booking.id || candidate.booking_no === booking.booking_no) === index
  );
};

export const createBookingDraft = async ({ user_id = null, schedule_id, items = [] }) => {
  const normalizedScheduleId = normalizeUuidish(schedule_id, 'schedule_id');
  assertNonEmptyArray(items, 'items');

  const normalizedItems = items.map((item, index) => ({
    ticket_type_id: normalizeUuidish(item.ticket_type_id, `items[${index}].ticket_type_id`),
    quantity: normalizePositiveInteger(item.quantity, `items[${index}].quantity`),
    unit_price: normalizeNonNegativeNumber(item.unit_price, `items[${index}].unit_price`)
  }));

  const { total_passengers, total_amount } = calculateTotals(normalizedItems);
  const { error: reserveError } = await supabase.rpc('reserve_schedule_seats', {
    p_schedule_id: normalizedScheduleId,
    p_seat_count: total_passengers
  });

  throwIfError(reserveError, 'Schedule is unavailable or has insufficient seats', 409);

  const booking_no = generateBookingNo();
  const expired_at = addMinutesIso(env.bookingHoldMinutes);

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        booking_no,
        user_id,
        schedule_id: normalizedScheduleId,
        total_passengers,
        total_amount,
        booking_status: 'draft',
        expired_at,
        source_channel: 'web'
      }])
      .select('*')
      .single();

    throwIfError(bookingError);

    const bookingItemsPayload = normalizedItems.map((item) => ({
      booking_id: booking.id,
      ticket_type_id: item.ticket_type_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: Number(item.quantity) * Number(item.unit_price)
    }));

    const { error: itemsError } = await supabase.from('booking_items').insert(bookingItemsPayload);
    throwIfError(itemsError);

    return getBookingByRef(booking.booking_no);
  } catch (error) {
    await supabase.rpc('release_schedule_seats', {
      p_schedule_id: normalizedScheduleId,
      p_seat_count: total_passengers
    });

    throw error;
  }
};

export const updateBookingDetails = async (bookingNo, payload) => {
  const normalizedBookingNo = normalizeString(bookingNo, { field: 'bookingNo', min: 6, max: 32 });
  const booking = await getBookingByRef(bookingNo);
  assert(!isExpired(booking.expired_at), 'Booking has expired', 410);
  assert(['draft', 'pending_payment'].includes(booking.booking_status), 'Booking cannot be edited');

  const passengers = payload.passengers || [];
  assertNonEmptyArray(passengers, 'passengers');
  assert(passengers.length === Number(booking.total_passengers), 'Passenger count must match reserved seats', 409);

  const contactUpdate = {
    contact_name: normalizeString(payload.contact_name, { field: 'contact_name', min: 2, max: 120 }),
    contact_phone: normalizePhone(payload.contact_phone, { required: true }),
    contact_email: normalizeEmail(payload.contact_email),
    booking_status: 'pending_payment'
  };

  const { error: bookingError } = await supabase
    .from('bookings')
    .update(contactUpdate)
    .eq('id', booking.id);

  throwIfError(bookingError);

  const { error: deleteError } = await supabase.from('passengers').delete().eq('booking_id', booking.id);
  throwIfError(deleteError);

  const passengerRows = passengers.map((passenger, index) => ({
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
    remark: normalizeOptionalString(passenger.remark, {
      field: `passengers[${index}].remark`,
      max: 255
    })
  }));

  const { error: insertPassengerError } = await supabase.from('passengers').insert(passengerRows);
  throwIfError(insertPassengerError);

  return getBookingByRef(normalizedBookingNo);
};

export const listBookingsForUser = async ({ user_id = null, user_email = null } = {}) => {
  const normalizedUserId = normalizeOptionalString(user_id, {
    field: 'user_id',
    min: 8,
    max: 64
  });
  const normalizedUserEmail = normalizeEmail(user_email, { required: false });

  assert(normalizedUserId || normalizedUserEmail, 'Unauthorized', 401);

  const bookingsByUserId = [];
  const bookingsByEmail = [];

  if (normalizedUserId) {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_WITH_RELATIONS_SELECT)
      .eq('user_id', normalizedUserId);

    throwIfError(error);
    bookingsByUserId.push(...(data || []));
  }

  if (normalizedUserEmail) {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_WITH_RELATIONS_SELECT)
      .eq('contact_email', normalizedUserEmail);

    throwIfError(error);
    bookingsByEmail.push(...(data || []));
  }

  return sortBookings(mergeBookings(bookingsByUserId, bookingsByEmail));
};

export const getBookingByRef = async (bookingNo) => {
  const normalizedBookingNo = normalizeString(bookingNo, { field: 'bookingNo', min: 6, max: 32 });
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(BOOKING_WITH_RELATIONS_SELECT)
    .eq('booking_no', normalizedBookingNo)
    .single();

  throwIfError(bookingError, 'Booking not found', 404);
  return booking;
};

export const confirmBooking = async (bookingId) => {
  const { error } = await supabase
    .from('bookings')
    .update({ booking_status: 'confirmed' })
    .eq('id', bookingId);

  throwIfError(error);
};

export const expireDraftBookings = async () => {
  const { data, error } = await supabase.rpc('expire_stale_bookings');
  throwIfError(error, 'Failed to expire stale bookings');
  return data;
};
