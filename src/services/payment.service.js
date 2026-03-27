import QRCode from 'qrcode';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { generatePaymentRef } from '../utils/ids.js';
import { throwIfError, assert } from './base.service.js';
import { getBookingByRef, confirmBooking } from './booking.service.js';
import { issueTicketsForBooking } from './ticket.service.js';
import { normalizeEmail, normalizeEnum, normalizeNonNegativeNumber, normalizeOptionalString, normalizeString } from '../utils/validation.js';

const PAYMENT_METHODS = ['qr_promptpay'];
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
    qr_text: raw.qr_text || raw.qr_value || null,
    qr_code_url: raw.qr_code_url || null
  };
};

export const createPayment = async ({ booking_no, contact_email, payment_method = 'qr_promptpay' }) => {
  const booking = await getBookingByRef(normalizeString(booking_no, { field: 'booking_no', min: 6, max: 32 }));
  assert(['pending_payment', 'draft'].includes(booking.booking_status), 'Booking is not payable');
  assert(booking.contact_name && booking.contact_phone && booking.contact_email, 'Booking contact details are incomplete', 409);
  assert((booking.passengers || []).length === Number(booking.total_passengers), 'Passenger details are incomplete', 409);
  assert(normalizeEmail(contact_email) === booking.contact_email.toLowerCase(), 'Payment access denied', 403);

  const existingSuccess = (booking.payments || []).find((payment) => payment.status === 'success');
  if (existingSuccess) {
    return serializePayment(existingSuccess);
  }

  const existingPending = (booking.payments || []).find((payment) => payment.status === 'pending');
  if (existingPending) {
    return serializePayment(existingPending);
  }

  const payment_ref = generatePaymentRef();
  const mockPaymentPayload = await buildMockPaymentPayload(payment_ref);
  const { data, error } = await supabase
    .from('payments')
    .insert([{
      booking_id: booking.id,
      payment_ref,
      payment_method: normalizeEnum(payment_method, PAYMENT_METHODS, 'payment_method'),
      gateway_name: 'mock_gateway',
      amount: booking.total_amount,
      status: 'pending',
      raw_response_json: mockPaymentPayload
    }])
    .select('*')
    .single();

  throwIfError(error);

  if (env.mockPaymentAutoSuccess) {
    return handlePaymentWebhook({
      payment_ref,
      status: 'success',
      transaction_id: `AUTO-${payment_ref}`,
      amount: Number(booking.total_amount),
      raw: {
        ...mockPaymentPayload,
        auto_success: true,
        confirmed_at: new Date().toISOString()
      }
    });
  }

  return serializePayment(data);
};

export const getPaymentByRef = async (paymentRef) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('payment_ref', normalizeString(paymentRef, { field: 'payment_ref', min: 6, max: 32 }))
    .single();

  throwIfError(error, 'Payment not found', 404);
  return serializePayment(data);
};

export const handlePaymentWebhook = async ({ payment_ref, status, transaction_id = null, amount = null, raw = {} }) => {
  const normalizedPaymentRef = normalizeString(payment_ref, { field: 'payment_ref', min: 6, max: 32 });
  const normalizedStatus = normalizeEnum(status, PAYMENT_STATUSES.filter((item) => item !== 'pending'), 'status');
  const payment = await getPaymentByRef(normalizedPaymentRef);

  if (payment.status !== 'pending') {
    assert(payment.status === normalizedStatus, 'Payment is already finalized', 409);
    return payment;
  }

  if (amount !== null) {
    assert(normalizeNonNegativeNumber(amount, 'amount') === Number(payment.amount), 'Amount mismatch', 409);
  }

  const updatePayload = {
    status: normalizedStatus,
    transaction_id: normalizeOptionalString(transaction_id, { field: 'transaction_id', max: 120 }),
    paid_at: normalizedStatus === 'success' ? new Date().toISOString() : null,
    raw_response_json: {
      ...(payment.raw_response_json || {}),
      ...(raw || {})
    }
  };

  const { error: paymentError } = await supabase
    .from('payments')
    .update(updatePayload)
    .eq('id', payment.id);

  throwIfError(paymentError);

  if (normalizedStatus === 'success') {
    await confirmBooking(payment.booking_id);
    await issueTicketsForBooking(payment.booking_id);
  }

  return getPaymentByRef(normalizedPaymentRef);
};
