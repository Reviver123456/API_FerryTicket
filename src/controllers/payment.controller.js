import { createPayment, getPaymentByRef, handlePaymentWebhook } from '../services/payment.service.js';
import { ok } from '../utils/http.js';

export const create = async (req, res, next) => {
  try {
    const data = await createPayment(req.body);
    return ok(res, data, 'Payment created', 201);
  } catch (error) {
    next(error);
  }
};

export const show = async (req, res, next) => {
  try {
    const data = await getPaymentByRef(req.params.paymentRef);
    return ok(res, data, 'Payment loaded');
  } catch (error) {
    next(error);
  }
};

export const webhook = async (req, res, next) => {
  try {
    const data = await handlePaymentWebhook({ ...req.body, raw: req.body });
    return ok(res, data, 'Webhook processed');
  } catch (error) {
    next(error);
  }
};
