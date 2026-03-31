import { createPayment, getPaymentByRef, handlePaymentWebhook } from '../services/payment.service.js';
import { createHandler as handle } from '../utils/controller.js';

export const create = handle(createPayment, 'Payment created', {
  status: 201
});

export const show = handle(getPaymentByRef, 'Payment loaded', {
  mapArgs: (req) => [req.params.paymentRef]
});

export const webhook = handle(handlePaymentWebhook, 'Webhook processed', {
  mapArgs: (req) => [{ ...req.body, raw: req.body }]
});
