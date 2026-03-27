import { fail } from '../utils/http.js';
import { verifyToken } from '../utils/auth.js';

export const authRequired = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return fail(res, 'Unauthorized', 401);

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return fail(res, 'Invalid token', 401);
  }
};
