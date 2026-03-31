import { fail } from '../utils/http.js';
import { verifySupabaseAccessToken } from '../services/supabaseAuth.service.js';
import { loadAuthenticatedUser, hasPermission } from '../services/access.service.js';

const getBearerToken = (header = '') => (header.startsWith('Bearer ') ? header.slice(7) : null);

const resolveCustomerRequest = async (token) => {
  const authUser = await verifySupabaseAccessToken(token);
  return loadAuthenticatedUser(authUser);
};

export const authRequired = async (req, res, next) => {
  const token = getBearerToken(req.headers.authorization || '');

  if (!token) return fail(res, 'Unauthorized', 401);

  try {
    req.user = await resolveCustomerRequest(token);
    return next();
  } catch (error) {
    const message = error.message === 'User account is not active'
      ? error.message
      : 'Invalid token';
    return fail(res, message, 401);
  }
};

export const permissionRequired = (...requiredPermissions) => (req, res, next) => {
  if (!req.user) {
    return fail(res, 'Unauthorized', 401);
  }

  if (!hasPermission(req.user, ...requiredPermissions)) {
    return fail(res, 'Forbidden', 403, {
      required_permissions: requiredPermissions
    });
  }

  return next();
};

export const authOptional = async (req, res, next) => {
  const token = getBearerToken(req.headers.authorization || '');

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = await resolveCustomerRequest(token);
    return next();
  } catch (error) {
    const message = error.message === 'User account is not active'
      ? error.message
      : 'Invalid token';
    return fail(res, message, 401);
  }
};
