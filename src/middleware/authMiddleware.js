import { fail } from '../utils/http.js';
import { verifyToken } from '../utils/auth.js';

const getBearerToken = (header = '') => (header.startsWith('Bearer ') ? header.slice(7) : null);

export const authRequired = (req, res, next) => {
  const token = getBearerToken(req.headers.authorization || '');

  if (!token) return fail(res, 'Unauthorized', 401);

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return fail(res, 'Invalid token', 401);
  }
};

export const authOptional = (req, res, next) => {
  const token = getBearerToken(req.headers.authorization || '');

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return fail(res, 'Invalid token', 401);
  }
};
