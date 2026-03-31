import { supabaseAdmin, supabaseAuth } from '../config/supabase.js';
import { AppError, assert } from './base.service.js';

export const SUPABASE_AUTH_PLACEHOLDER = 'supabase_auth';

const isAlreadyRegisteredError = (error) => /already registered|exists/i.test(error?.message || '');

export const createAuthIdentity = async ({
  email,
  password,
  scope = 'customer',
  metadata = {}
}) => {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      scope,
      ...metadata
    }
  });

  if (error && !isAlreadyRegisteredError(error)) {
    throw new AppError(error.message || 'Unable to create auth user', 400);
  }

  return data?.user || null;
};

export const findAuthIdentityByEmail = async (email) => {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw new AppError(error.message || 'Unable to search auth users', 500);
    }

    const users = data?.users || [];
    const matchedUser = users.find((user) => String(user.email || '').toLowerCase() === String(email || '').toLowerCase());
    if (matchedUser) {
      return matchedUser;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
};

export const signInWithSupabasePassword = async ({ email, password }) => {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data?.session || !data?.user) {
    throw new AppError(error?.message || 'Invalid email or password', 401);
  }

  return data;
};

export const verifySupabaseAccessToken = async (token) => {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw new AppError('Invalid token', 401);
  }
  return data.user;
};

export const updateAuthIdentity = async (authUserId, attributes = {}) => {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, attributes);

  if (error || !data?.user) {
    throw new AppError(error?.message || 'Unable to update auth user', 400);
  }

  return data.user;
};

export const updateAuthIdentityPassword = async (authUserId, password) => updateAuthIdentity(authUserId, {
  password,
  email_confirm: true
});

export const ensureAuthSession = async ({
  email,
  password,
  scope = 'customer',
  metadata = {}
}) => {
  await createAuthIdentity({ email, password, scope, metadata });
  return signInWithSupabasePassword({ email, password });
};

export const linkAuthIdentityToLocalRecord = async ({
  table,
  localId,
  authUserId
}) => {
  assert(['users', 'admin_users'].includes(table), 'table is invalid');
  const { error } = await supabaseAdmin
    .from(table)
    .update({
      auth_user_id: authUserId,
      password: SUPABASE_AUTH_PLACEHOLDER
    })
    .eq('id', localId);

  if (error) {
    throw new AppError(error.message || 'Unable to sync auth identity', 500);
  }
};
