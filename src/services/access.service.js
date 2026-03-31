import { supabase } from '../config/supabase.js';
import { normalizeEmail } from '../utils/validation.js';
import { assert, throwIfError } from './base.service.js';
import { linkAuthIdentityToLocalRecord } from './supabaseAuth.service.js';
import { uniquePermissions } from '../constants/permissions.js';

export const ROLE_COLUMNS = 'id, code, name, description, permissions, status, sort_order, created_at, updated_at';
const USER_PUBLIC_COLUMNS = 'id, code, role_id, user_type, first_name, last_name, email, phone, profile_image_url, status, last_login_at, created_at, updated_at';
export const USER_PRIVATE_COLUMNS = `${USER_PUBLIC_COLUMNS}, password_hash, auth_user_id, permissions_override, profile_image_path`;

const normalizePermissions = (permissions = []) => (
  Array.isArray(permissions)
    ? permissions.filter((permission) => typeof permission === 'string' && permission.length > 0)
    : []
);

export const sanitizeRole = (role) => {
  if (!role) return null;
  return {
    ...role,
    permissions: normalizePermissions(role.permissions)
  };
};

export const sanitizeUser = (user) => {
  if (!user) return null;

  const {
    password_hash,
    auth_user_id,
    permissions_override,
    profile_image_path,
    ...safeUser
  } = user;

  return safeUser;
};

export const getRoleById = async (id) => {
  if (!id) return null;

  const { data, error } = await supabase
    .from('roles')
    .select(ROLE_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  throwIfError(error);
  return sanitizeRole(data);
};

export const getRoleByCode = async (code) => {
  if (!code) return null;

  const { data, error } = await supabase
    .from('roles')
    .select(ROLE_COLUMNS)
    .eq('code', String(code).trim().toLowerCase())
    .maybeSingle();

  throwIfError(error);
  return sanitizeRole(data);
};

export const getUserWithPrivateFieldsById = async (id) => {
  const { data, error } = await supabase
    .from('users')
    .select(USER_PRIVATE_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  throwIfError(error);
  return data;
};

export const getUserWithPrivateFieldsByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase
    .from('users')
    .select(USER_PRIVATE_COLUMNS)
    .eq('email', normalizedEmail)
    .maybeSingle();

  throwIfError(error);
  return data;
};

export const buildUserContext = async (user) => {
  if (!user) return null;

  const role = await getRoleById(user.role_id);
  const rolePermissions = normalizePermissions(role?.permissions);
  const overridePermissions = normalizePermissions(user.permissions_override);

  return {
    ...sanitizeUser(user),
    role,
    permissions: uniquePermissions([...rolePermissions, ...overridePermissions])
  };
};

export const hasPermission = (user, ...requiredPermissions) => {
  const permissions = user?.permissions || [];
  if (permissions.includes('*')) return true;
  return requiredPermissions.every((permission) => permissions.includes(permission));
};

export const loadAuthenticatedUser = async (authUser) => {
  const authEmail = normalizeEmail(authUser?.email || '');

  let user = null;
  const { data: linkedUser, error: linkedError } = await supabase
    .from('users')
    .select(USER_PRIVATE_COLUMNS)
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  throwIfError(linkedError);
  user = linkedUser;

  if (!user) {
    const { data: emailUser, error: emailError } = await supabase
      .from('users')
      .select(USER_PRIVATE_COLUMNS)
      .eq('email', authEmail)
      .maybeSingle();

    throwIfError(emailError);

    if (emailUser) {
      if (!emailUser.auth_user_id) {
        await linkAuthIdentityToLocalRecord({
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

  assert(user, 'Unauthorized', 401);
  assert(user.status === 'active', 'User account is not active', 403);

  return buildUserContext(user);
};
