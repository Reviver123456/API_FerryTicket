import { fail } from '../utils/http.js';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = statusCode >= 500 && env.isProduction
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');

  console.error(`[${req.requestId || 'n/a'}]`, err);
  return fail(res, message, statusCode, err.details || null, {
    request_id: req.requestId || null
  });
};
