import { supabase } from '../config/supabase.js';
import { throwIfError } from './base.service.js';
import { normalizeDateString } from '../utils/validation.js';

const withDateRange = (builder, field, query = {}) => {
  const dateFrom = normalizeDateString(query.dateFrom || query.date_from, 'dateFrom', { required: false });
  const dateTo = normalizeDateString(query.dateTo || query.date_to, 'dateTo', { required: false });

  let nextBuilder = builder;
  if (dateFrom) nextBuilder = nextBuilder.gte(field, `${dateFrom}T00:00:00.000Z`);
  if (dateTo) nextBuilder = nextBuilder.lte(field, `${dateTo}T23:59:59.999Z`);
  return nextBuilder;
};

export const getDashboard = async (query = {}) => {
  const bookingsQuery = withDateRange(
    supabase.from('bookings').select('id, total_amount, booking_status, payment_status', { count: 'exact' }),
    'created_at',
    query
  );
  const paymentsQuery = withDateRange(
    supabase.from('payments').select('id, amount, status', { count: 'exact' }),
    'created_at',
    query
  );
  const schedulesQuery = supabase.from('schedules').select('id, status', { count: 'exact' });

  const [{ data: bookings, count: bookingCount, error: bookingError }, { data: payments, count: paymentCount, error: paymentError }, { data: schedules, count: scheduleCount, error: scheduleError }] = await Promise.all([
    bookingsQuery,
    paymentsQuery,
    schedulesQuery
  ]);

  throwIfError(bookingError);
  throwIfError(paymentError);
  throwIfError(scheduleError);

  const bookingRows = bookings || [];
  const paymentRows = payments || [];
  const scheduleRows = schedules || [];

  return {
    bookings: {
      total: bookingCount || bookingRows.length,
      draft: bookingRows.filter((item) => item.booking_status === 'draft').length,
      confirmed: bookingRows.filter((item) => item.booking_status === 'confirmed').length,
      cancelled: bookingRows.filter((item) => item.booking_status === 'cancelled').length
    },
    payments: {
      total: paymentCount || paymentRows.length,
      success_count: paymentRows.filter((item) => item.status === 'success').length,
      pending_count: paymentRows.filter((item) => item.status === 'pending').length,
      refunded_count: paymentRows.filter((item) => item.status === 'refunded').length,
      success_amount: paymentRows
        .filter((item) => item.status === 'success')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    },
    schedules: {
      total: scheduleCount || scheduleRows.length,
      open: scheduleRows.filter((item) => item.status === 'open').length,
      closed: scheduleRows.filter((item) => item.status === 'closed').length,
      cancelled: scheduleRows.filter((item) => item.status === 'cancelled').length
    }
  };
};

export const getSalesReport = async (query = {}) => {
  const paymentsQuery = withDateRange(
    supabase.from('payments').select('*').eq('status', 'success'),
    'created_at',
    query
  );
  const { data: payments, error } = await paymentsQuery;
  throwIfError(error);

  const rows = payments || [];
  return {
    summary: {
      payment_count: rows.length,
      total_amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    },
    payments: rows
  };
};

export const getPassengerReport = async (query = {}) => {
  const bookingsQuery = withDateRange(
    supabase.from('bookings').select('id, booking_no, passenger_count, booking_status, source_channel, created_at'),
    'created_at',
    query
  );
  const { data: bookings, error } = await bookingsQuery;
  throwIfError(error);

  const rows = bookings || [];
  return {
    summary: {
      booking_count: rows.length,
      total_passengers: rows.reduce((sum, row) => sum + Number(row.passenger_count || 0), 0)
    },
    bookings: rows
  };
};
