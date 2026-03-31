import QRCode from 'qrcode';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { generatePaymentRef } from '../utils/ids.js';
import { assert, throwIfError } from './base.service.js';
import {
  assertBookingAccess,
  getBookingByRef,
  listBookings,
  setBookingAsPaid,
  setBookingAsRefunded,
  setBookingPaymentPending
} from './booking.service.js';
import { hasPermission } from './access.service.js';
import { issueTicketsForBooking } from './ticket.service.js';
import {
  normalizeNonNegativeNumber,
  normalizeOptionalString,
  normalizeString
} from '../utils/validation.js';

const PAYMENT_METHODS = ['cash', 'transfer', 'qr_promptpay', 'card', 'manual'];
const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'expired', 'refunded'];

const buildMockPaymentPayload = async (paymentRef) => {
  const qrValue = paymentRef;
  const qrCodeUrl = await QRCode.toDataURL(qrValue);

  return {
    payment_url: `${env.appUrl.replace(/\/+$/, '')}/mock-payment/${paymentRef}`,
    qr_value: qrValue,
    qr_code_url: qrCodeUrl
  };
};

const serializePayment = (payment) => {
  const raw = payment?.raw_response_json || {};

  return {
    ...payment,
    payment_url: raw.payment_url || null,
    qr_value: raw.qr_value || null,
    qr_code_url: raw.qr_code_url || null
  };
};

const getPaymentRecord = async (paymentRef) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('payment_ref', normalizeString(paymentRef, {
      field: 'payment_ref',
      min: 6,
      max: 32
    }))
    .single();

  throwIfError(error, 'Payment not found', 404);
  return data;
};

const assertPaymentAccess = async (payment, actor = null, contactEmail = null) => {
  if (actor && hasPermission(actor, 'payments.view')) return;

  const { data, error } = await supabase
    .from('bookings')
    .select('booking_no')
    .eq('id', payment.booking_id)
    .single();

  throwIfError(error, 'Booking not found', 404);
  const booking = await getBookingByRef(data.booking_no);
  assertBookingAccess(booking, actor, contactEmail);
};

const finalizePayment = async (paymentRef, {
  status,
  transaction_id = null,
  amount = null,
  raw = {},
  confirmed_by_user_id = null
}) => {
  const payment = await getPaymentRecord(paymentRef);
  const normalizedStatus = normalizeString(status, {
    field: 'status',
    min: 4,
    max: 20
  });
  assert(PAYMENT_STATUSES.includes(normalizedStatus) && normalizedStatus !== 'pending', 'status is invalid');

  if (payment.status !== 'pending') {
    assert(payment.status === normalizedStatus, 'Payment is already finalized', 409);
    return serializePayment(payment);
  }

  if (amount !== null && amount !== undefined) {
    assert(normalizeNonNegativeNumber(amount, 'amount') === Number(payment.amount), 'Amount mismatch', 409);
  }

  const updatePayload = {
    status: normalizedStatus,
    transaction_id: normalizeOptionalString(transaction_id, {
      field: 'transaction_id',
      max: 120
    }),
    paid_at: normalizedStatus === 'success' ? new Date().toISOString() : payment.paid_at,
    confirmed_by_user_id: confirmed_by_user_id,
    raw_response_json: {
      ...(payment.raw_response_json || {}),
      ...(raw || {})
    }
  };

  const { error } = await supabase
    .from('payments')
    .update(updatePayload)
    .eq('id', payment.id);

  throwIfError(error);

  if (normalizedStatus === 'success') {
    await setBookingAsPaid(payment.booking_id);
    await issueTicketsForBooking(payment.booking_id);
  }

  if (normalizedStatus === 'failed' || normalizedStatus === 'expired') {
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        payment_status: normalizedStatus === 'expired' ? 'failed' : normalizedStatus,
        booking_status: 'pending_payment'
      })
      .eq('id', payment.booking_id);

    throwIfError(bookingError);
  }

  return serializePayment(await getPaymentRecord(paymentRef));
};

export const createPayment = async (payload, actor = null) => {
  const booking = await getBookingByRef(normalizeString(payload.booking_no, {
    field: 'booking_no',
    min: 6,
    max: 32
  }));
  assertBookingAccess(booking, actor, payload.contact_email);
  assert(['pending_payment', 'draft', 'confirmed'].includes(booking.booking_status), 'Booking is not payable', 409);
  assert(booking.contact_name && booking.contact_phone && booking.contact_email, 'Booking contact details are incomplete', 409);
  assert((booking.passengers || []).length === Number(booking.passenger_count), 'Passenger details are incomplete', 409);

  const existingSuccess = (booking.payments || []).find((payment) => payment.status === 'success');
  if (existingSuccess) {
    return serializePayment(existingSuccess);
  }

  const existingPending = (booking.payments || []).find((payment) => payment.status === 'pending');
  if (existingPending) {
    return serializePayment(existingPending);
  }

  const payment_ref = generatePaymentRef();
  const payment_method = normalizeString(payload.payment_method || 'qr_promptpay', {
    field: 'payment_method',
    min: 3,
    max: 30
  });
  assert(PAYMENT_METHODS.includes(payment_method), 'payment_method is invalid');

  const mockPayload = await buildMockPaymentPayload(payment_ref);
  const { data, error } = await supabase
    .from('payments')
    .insert([{
      booking_id: booking.id,
      payment_ref,
      payment_method,
      gateway_name: payment_method === 'qr_promptpay' ? 'mock_gateway' : 'manual_gateway',
      amount: booking.total_amount,
      currency: 'THB',
      status: 'pending',
      raw_response_json: mockPayload
    }])
    .select('*')
    .single();

  throwIfError(error);
  await setBookingPaymentPending(booking.id);

  if (env.mockPaymentAutoSuccess) {
    return finalizePayment(payment_ref, {
      status: 'success',
      transaction_id: `AUTO-${payment_ref}`,
      amount: Number(booking.total_amount),
      raw: {
        ...mockPayload,
        auto_success: true,
        confirmed_at: new Date().toISOString()
      }
    });
  }

  return serializePayment(data);
};

export const listPayments = async (query = {}, actor) => {
  assert(actor, 'Unauthorized', 401);

  let builder = supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });

  const paymentRef = normalizeOptionalString(query.paymentRef || query.payment_ref, {
    field: 'paymentRef',
    min: 4,
    max: 32
  });
  const status = normalizeOptionalString(query.status, {
    field: 'status',
    min: 4,
    max: 20
  });

  if (paymentRef) builder = builder.ilike('payment_ref', `%${paymentRef}%`);
  if (status) builder = builder.eq('status', status);

  if (hasPermission(actor, 'payments.view')) {
    const { data, error } = await builder;
    throwIfError(error);
    return (data || []).map(serializePayment);
  }

  const bookings = await listBookings({}, actor);
  const bookingIds = bookings.map((booking) => booking.id);
  if (bookingIds.length === 0) return [];

  builder = builder.in('booking_id', bookingIds);
  const { data, error } = await builder;
  throwIfError(error);
  return (data || []).map(serializePayment);
};

export const getPaymentByRef = async (paymentRef, actor = null, contactEmail = null) => {
  const payment = await getPaymentRecord(paymentRef);
  await assertPaymentAccess(payment, actor, contactEmail);
  return serializePayment(payment);
};

export const confirmPayment = async (paymentRef, payload = {}, actor = null) => finalizePayment(paymentRef, {
  status: 'success',
  transaction_id: payload.transaction_id || payload.reference_no || `MANUAL-${paymentRef}`,
  amount: payload.amount ?? null,
  raw: {
    confirmed_by: actor?.email || 'system',
    note: payload.note || null
  },
  confirmed_by_user_id: actor?.id || null
});

export const refundPayment = async (paymentRef, payload = {}, actor = null) => {
  const payment = await getPaymentRecord(paymentRef);
  assert(payment.status === 'success', 'Only successful payments can be refunded', 409);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('payments')
    .update({
      status: 'refunded',
      refund_reason: normalizeOptionalString(payload.reason || payload.refund_reason, {
        field: 'reason',
        max: 255
      }),
      refunded_at: now,
      refunded_by_user_id: actor?.id || null
    })
    .eq('id', payment.id);

  throwIfError(error);

  await setBookingAsRefunded(payment.booking_id);

  const { error: ticketError } = await supabase
    .from('tickets')
    .update({
      status: 'refunded'
    })
    .eq('booking_id', payment.booking_id);

  throwIfError(ticketError);
  return serializePayment(await getPaymentRecord(paymentRef));
};

export const markBookingPaid = async (bookingNo, payload = {}, actor = null) => {
  const booking = await getBookingByRef(bookingNo);
  const existingSuccess = (booking.payments || []).find((payment) => payment.status === 'success');
  if (existingSuccess) {
    return serializePayment(existingSuccess);
  }

  let payment = (booking.payments || []).find((item) => item.status === 'pending');
  if (!payment) {
    const { data, error } = await supabase
      .from('payments')
      .insert([{
        booking_id: booking.id,
        payment_ref: generatePaymentRef(),
        payment_method: normalizeString(payload.payment_method || 'manual', {
          field: 'payment_method',
          min: 3,
          max: 30
        }),
        gateway_name: 'manual_gateway',
        amount: booking.total_amount,
        currency: 'THB',
        status: 'pending',
        raw_response_json: {
          created_by: actor?.email || 'system'
        }
      }])
      .select('*')
      .single();

    throwIfError(error);
    payment = data;
  }

  return confirmPayment(payment.payment_ref, payload, actor);
};

export const refundBookingPayment = async (bookingNo, payload = {}, actor = null) => {
  const booking = await getBookingByRef(bookingNo);
  const payment = (booking.payments || []).find((item) => item.status === 'success');
  assert(payment, 'Successful payment not found', 404);
  return refundPayment(payment.payment_ref, payload, actor);
};

export const handlePaymentWebhook = async ({ payment_ref, status, transaction_id = null, amount = null, raw = {} }) => finalizePayment(payment_ref, {
  status,
  transaction_id,
  amount,
  raw
});
