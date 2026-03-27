import { supabase } from '../config/supabase.js';
import { generatePaymentRef } from '../utils/ids.js';
import { throwIfError, assert } from './base.service.js';
import { getBookingByRef, confirmBooking } from './booking.service.js';
import { issueTicketsForBooking } from './ticket.service.js';
import { normalizeEmail, normalizeEnum, normalizeNonNegativeNumber, normalizeOptionalString, normalizeString } from '../utils/validation.js';

const PAYMENT_METHODS = ['qr_promptpay'];
const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'expired', 'refunded'];

export const createPayment = async ({ booking_no, contact_email, payment_method = 'qr_promptpay' }) => {
  const booking = await getBookingByRef(normalizeString(booking_no, { field: 'booking_no', min: 6, max: 32 }));
  assert(['pending_payment', 'draft'].includes(booking.booking_status), 'Booking is not payable');
  assert(booking.contact_name && booking.contact_phone && booking.contact_email, 'Booking contact details are incomplete', 409);
  assert((booking.passengers || []).length === Number(booking.total_passengers), 'Passenger details are incomplete', 409);
  assert(normalizeEmail(contact_email) === booking.contact_email.toLowerCase(), 'Payment access denied', 403);

  const existingSuccess = (booking.payments || []).find((payment) => payment.status === 'success');
  assert(!existingSuccess, 'Booking already paid', 409);

  const existingPending = (booking.payments || []).find((payment) => payment.status === 'pending');
  if (existingPending) {
    return existingPending;
  }

  const payment_ref = generatePaymentRef();
  const { data, error } = await supabase
    .from('payments')
    .insert([{
      booking_id: booking.id,
      payment_ref,
      payment_method: normalizeEnum(payment_method, PAYMENT_METHODS, 'payment_method'),
      gateway_name: 'mock_gateway',
      amount: booking.total_amount,
      status: 'pending',
      raw_response_json: {
        payment_url: `/mock-payment/${payment_ref}`,
        qr_value: payment_ref
      }
    }])
    .select('*')
    .single();

  throwIfError(error);
  return data;
};

export const getPaymentByRef = async (paymentRef) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('payment_ref', normalizeString(paymentRef, { field: 'payment_ref', min: 6, max: 32 }))
    .single();

  throwIfError(error, 'Payment not found', 404);
  return data;
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
    raw_response_json: raw
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
