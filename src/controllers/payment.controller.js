import {
  confirmPayment,
  createPayment,
  getPaymentByRef,
  handlePaymentWebhook,
  listPayments,
  refundPayment
} from '../services/payment.service.js';
import { createHandler as handle } from '../utils/controller.js';

export const create = handle(createPayment, 'Payment created', {
  status: 201,
  mapArgs: (req) => [req.body, req.user || null]
});

export const index = handle(listPayments, 'Payments loaded', {
  mapArgs: (req) => [req.query, req.user]
});

export const show = handle(getPaymentByRef, 'Payment loaded', {
  mapArgs: (req) => [req.params.paymentRef, req.user || null, req.query.contact_email || null]
});

export const confirm = handle(confirmPayment, 'Payment confirmed', {
  mapArgs: (req) => [req.params.paymentRef, req.body, req.user]
});

export const refund = handle(refundPayment, 'Payment refunded', {
  mapArgs: (req) => [req.params.paymentRef, req.body, req.user]
});

export const webhook = handle(handlePaymentWebhook, 'Webhook processed', {
  mapArgs: (req) => [{ ...req.body, raw: req.body }]
});
