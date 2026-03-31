import { supabase } from '../config/supabase.js';
import { fail } from '../utils/http.js';
import {
  linkAuthIdentityToLocalRecord,
  verifySupabaseAccessToken
} from '../services/supabaseAuth.service.js';

const getBearerToken = (header = '') => (header.startsWith('Bearer ') ? header.slice(7) : null);

const loadCustomerSession = async (authUser) => {
  const authScope = authUser?.user_metadata?.scope;
  if (authScope && authScope !== 'customer') {
    throw new Error('Unauthorized');
  }

  const authEmail = String(authUser.email || '').toLowerCase();
  const { data: linkedUser, error: linkedError } = await supabase
    .from('users')
    .select('id, full_name, phone, email, status, auth_user_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (linkedError) {
    throw linkedError;
  }

  let user = linkedUser;

  if (!user && authEmail) {
    const { data: emailUser, error: emailError } = await supabase
      .from('users')
      .select('id, full_name, phone, email, status, auth_user_id')
      .eq('email', authEmail)
      .maybeSingle();

    if (emailError) {
      throw emailError;
    }

    if (emailUser) {
      if (!emailUser.auth_user_id) {
        await linkAuthIdentityToLocalRecord({
          table: 'users',
          localId: emailUser.id,
          authUserId: authUser.id
        });
      }
      user = {
        ...emailUser,
        auth_user_id: authUser.id
      };
    }
  }

  if (!user) {
    throw new Error('Unauthorized');
  }

  if (user.status !== 'active') {
    throw new Error('User account is not active');
  }

  return {
    sub: user.id,
    auth_user_id: authUser.id,
    email: user.email,
    role: 'customer',
    scope: 'customer'
  };
};

const resolveCustomerRequest = async (token) => {
  const authUser = await verifySupabaseAccessToken(token);
  return loadCustomerSession(authUser);
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
