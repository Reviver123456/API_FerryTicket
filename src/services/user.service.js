import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { signToken } from '../utils/auth.js';
import { throwIfError, assert } from './base.service.js';
import { hashPassword, needsPasswordRehash, verifyPassword } from '../utils/password.js';
import { normalizeEmail, normalizePhone, normalizeString } from '../utils/validation.js';

const PUBLIC_USER_COLUMNS = 'id, full_name, phone, email, status, created_at, updated_at';

const sanitizeUser = ({ password, ...user }) => user;

export const registerUser = async ({ full_name, phone, email, password }) => {
  const normalizedUser = {
    full_name: normalizeString(full_name, { field: 'full_name', min: 2, max: 120 }),
    phone: normalizePhone(phone),
    email: normalizeEmail(email),
    password: normalizeString(password, {
      field: 'password',
      min: env.minPasswordLength,
      max: 128,
      trim: false
    })
  };

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedUser.email)
    .maybeSingle();

  throwIfError(existingError);
  assert(!existing, 'Email already exists', 409);

  const passwordHash = await hashPassword(normalizedUser.password);
  const { data, error } = await supabase
    .from('users')
    .insert([{
      full_name: normalizedUser.full_name,
      phone: normalizedUser.phone,
      email: normalizedUser.email,
      password: passwordHash
    }])
    .select(PUBLIC_USER_COLUMNS)
    .single();

  throwIfError(error);

  return {
    user: sanitizeUser(data),
    token: signToken({ sub: data.id, email: data.email, role: 'customer' })
  };
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizeString(password, {
    field: 'password',
    min: 1,
    max: 128,
    trim: false
  });

  const { data, error } = await supabase
    .from('users')
    .select(`${PUBLIC_USER_COLUMNS}, password`)
    .eq('email', normalizedEmail)
    .maybeSingle();

  throwIfError(error);
  assert(data, 'Invalid email or password', 401);
  assert(data.status === 'active', 'User account is not active', 403);

  const isValidPassword = await verifyPassword(normalizedPassword, data.password);
  assert(isValidPassword, 'Invalid email or password', 401);

  if (needsPasswordRehash(data.password)) {
    const upgradedPassword = await hashPassword(normalizedPassword);
    const { error: upgradeError } = await supabase
      .from('users')
      .update({ password: upgradedPassword })
      .eq('id', data.id);

    throwIfError(upgradeError);
  }

  return {
    user: sanitizeUser(data),
    token: signToken({ sub: data.id, email: data.email, role: 'customer' })
  };
};

export const getMe = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, phone, email, status, created_at')
    .eq('id', userId)
    .single();

  throwIfError(error);
  return data;
};
