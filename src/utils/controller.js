import { ok } from './http.js';

export const createHandler = (service, message, {
  status = 200,
  mapArgs = (req) => [req.body]
} = {}) => async (req, res, next) => {
  try {
    const data = await service(...mapArgs(req));
    const resolvedMessage = typeof message === 'function'
      ? message(data, req)
      : (message || data?.message || 'OK');
    return ok(res, data, resolvedMessage, status);
  } catch (error) {
    next(error);
  }
};
