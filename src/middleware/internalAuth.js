import { timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';
import { fail } from '../utils/http.js';

const matchesSecret = (expected, actual) => {
  if (!expected || !actual) return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, actualBuffer);
};

export const internalApiKeyRequired = (req, res, next) => {
  const providedKey = req.get('x-internal-api-key');

  if (!matchesSecret(env.internalApiKey, providedKey)) {
    return fail(res, 'Unauthorized', 401);
  }

  next();
};

export const webhookSecretRequired = (req, res, next) => {
  const providedSecret = req.get('x-webhook-secret');

  if (!matchesSecret(env.paymentWebhookSecret, providedSecret)) {
    return fail(res, 'Unauthorized', 401);
  }

  next();
};
