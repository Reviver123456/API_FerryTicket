import { createHash, randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { generateUserCode } from '../utils/ids.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  normalizeEmail,
  normalizeOptionalString,
  normalizePhone,
  normalizeString,
  normalizeUuidish
} from '../utils/validation.js';
import { assert, throwIfError } from './base.service.js';
import {
  buildUserContext,
  getRoleByCode,
  getRoleById,
  getUserWithPrivateFieldsByEmail,
  getUserWithPrivateFieldsById,
  sanitizeUser,
  USER_PRIVATE_COLUMNS
} from './access.service.js';
import {
  createAuthIdentity,
  findAuthIdentityByEmail,
  linkAuthIdentityToLocalRecord,
  signInWithSupabasePassword,
  SUPABASE_AUTH_PLACEHOLDER,
  updateAuthIdentity,
  updateAuthIdentityPassword
} from './supabaseAuth.service.js';

const PROFILE_IMAGE_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

let profileBucketReady = false;

const hashResetToken = (token) => createHash('sha256').update(token).digest('hex');

const splitFullName = (fullName) => {
  const normalized = normalizeString(fullName, {
    field: 'full_name',
    min: 2,
    max: 120
  });
  const parts = normalized.split(/\s+/).filter(Boolean);
  return {
    first_name: parts.shift() || normalized,
    last_name: parts.join(' ') || '-'
  };
};

const normalizeNameFields = (payload = {}, { allowPartial = false } = {}) => {
  const hasStructuredNames = payload.first_name !== undefined || payload.last_name !== undefined;
  const hasFullName = payload.full_name !== undefined && payload.full_name !== null && String(payload.full_name).trim() !== '';

  if (!allowPartial && !hasStructuredNames && !hasFullName) {
    assert(false, 'first_name is required');
  }

  const fullNameParts = hasFullName ? splitFullName(payload.full_name) : null;
  const first_name = payload.first_name !== undefined
    ? normalizeString(payload.first_name, {
      field: 'first_name',
      min: 2,
      max: 80,
      required: !allowPartial
    })
    : (fullNameParts?.first_name || null);
  const last_name = payload.last_name !== undefined
    ? normalizeString(payload.last_name, {
      field: 'last_name',
      min: 1,
      max: 120,
      required: !allowPartial
    })
    : (fullNameParts?.last_name || null);

  return {
    first_name,
    last_name
  };
};

const buildAuthResponse = (user, session) => ({
  user,
  token: session.access_token,
  refresh_token: session.refresh_token,
  session: {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type
  }
});

const ensureUserAuthIdentity = async (user, password) => {
  let authUser = user.auth_user_id
    ? { id: user.auth_user_id, email: user.email }
    : await createAuthIdentity({
      email: user.email,
      password,
      scope: 'app_user',
      metadata: {
        local_user_id: user.id,
        user_type: user.user_type
      }
    });

  if (!authUser) {
    authUser = await findAuthIdentityByEmail(user.email);
  }

  assert(authUser, 'Unable to provision authentication account', 500);

  await updateAuthIdentity(authUser.id, {
    password,
    email_confirm: true,
    user_metadata: {
      local_user_id: user.id,
      user_type: user.user_type
    }
  });

  await linkAuthIdentityToLocalRecord({
    localId: user.id,
    authUserId: authUser.id
  });

  return authUser;
};

const ensureEmailAvailable = async (email, excludeUserId = null) => {
  let builder = supabase
    .from('users')
    .select('id')
    .eq('email', email);

  if (excludeUserId) builder = builder.neq('id', excludeUserId);

  const { data, error } = await builder.maybeSingle();
  throwIfError(error);
  assert(!data, 'Email already exists', 409);
};

const updateLastLogin = async (userId) => {
  const { error } = await supabase
    .from('users')
    .update({
      last_login_at: new Date().toISOString()
    })
    .eq('id', userId);

  throwIfError(error);
};

const resolveRole = async ({ role_id = null, role_code = null, fallbackCode = null }) => {
  if (role_id) {
    const role = await getRoleById(normalizeUuidish(role_id, 'role_id'));
    assert(role, 'role_id is invalid');
    assert(role.status === 'active', 'role_id is inactive', 409);
    return role;
  }

  const code = role_code || fallbackCode;
  assert(code, 'role_code is required');
  const role = await getRoleByCode(code);
  assert(role, 'role_code is invalid');
  assert(role.status === 'active', 'role_code is inactive', 409);
  return role;
};

const parseBase64Image = (value, mimeTypeOverride = null) => {
  const normalizedValue = normalizeString(value, {
    field: 'image_base64',
    min: 16,
    max: env.profileImageMaxBytes * 4,
    trim: true
  });

  const dataUrlMatch = normalizedValue.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const mimeType = dataUrlMatch?.[1] || normalizeString(mimeTypeOverride, {
    field: 'mime_type',
    min: 9,
    max: 50,
    required: !!mimeTypeOverride
  });
  const base64Payload = dataUrlMatch?.[2] || normalizedValue;
  const extension = PROFILE_IMAGE_MIME_TYPES[mimeType];

  assert(extension, 'mime_type is not supported');
  assert(/^[A-Za-z0-9+/=]+$/.test(base64Payload), 'image_base64 must be valid base64');

  const buffer = Buffer.from(base64Payload, 'base64');
  assert(buffer.length > 0, 'image_base64 is invalid');
  assert(buffer.length <= env.profileImageMaxBytes, `Profile image must not exceed ${env.profileImageMaxBytes} bytes`);

  return { buffer, mimeType, extension };
};

const ensureProfileImageBucket = async () => {
  if (profileBucketReady) return;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  throwIfError(listError, 'Unable to access storage', 500);

  const exists = buckets?.some((bucket) => bucket.name === env.profileImageBucket);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(env.profileImageBucket, {
      public: true,
      fileSizeLimit: env.profileImageMaxBytes,
      allowedMimeTypes: Object.keys(PROFILE_IMAGE_MIME_TYPES)
    });

    throwIfError(createError, 'Unable to prepare profile image storage', 500);
  }

  profileBucketReady = true;
};

const loadUserContextById = async (userId) => {
  const user = await getUserWithPrivateFieldsById(userId);
  assert(user, 'User not found', 404);
  return buildUserContext(user);
};

const normalizeUserStatus = (status, { required = false } = {}) => {
  const normalized = required
    ? normalizeString(status, { field: 'status', min: 4, max: 20 })
    : normalizeOptionalString(status, { field: 'status', min: 4, max: 20 });

  if (!normalized) return null;
  assert(['active', 'inactive', 'suspended'].includes(normalized), 'status is invalid');
  return normalized;
};

const normalizeUserType = (userType, { required = false } = {}) => {
  const normalized = required
    ? normalizeString(userType, { field: 'user_type', min: 4, max: 20 })
    : normalizeOptionalString(userType, { field: 'user_type', min: 4, max: 20 });

  if (!normalized) return null;
  assert(['customer', 'admin', 'agent', 'staff'].includes(normalized), 'user_type is invalid');
  return normalized;
};

export const registerUser = async (payload) => {
  const names = normalizeNameFields(payload);
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const password = normalizeString(payload.password, {
    field: 'password',
    min: env.minPasswordLength,
    max: 128,
    trim: false
  });
  const customerRole = await resolveRole({
    fallbackCode: 'customer'
  });

  await ensureEmailAvailable(email);

  const authUser = await createAuthIdentity({
    email,
    password,
    scope: 'app_user',
    metadata: {
      user_type: 'customer'
    }
  });
  assert(authUser, 'Email already exists', 409);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      code: generateUserCode(),
      role_id: customerRole.id,
      user_type: 'customer',
      first_name: names.first_name,
      last_name: names.last_name,
      email,
      phone,
      password_hash: SUPABASE_AUTH_PLACEHOLDER,
      auth_user_id: authUser.id,
      status: 'active'
    }])
    .select(USER_PRIVATE_COLUMNS)
    .single();

  throwIfError(error);

  const authSession = await signInWithSupabasePassword({
    email,
    password
  });

  const user = await buildUserContext(data);
  await updateLastLogin(user.id);
  user.last_login_at = new Date().toISOString();

  return buildAuthResponse(user, authSession.session);
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizeString(password, {
    field: 'password',
    min: 1,
    max: 128,
    trim: false
  });

  const data = await getUserWithPrivateFieldsByEmail(normalizedEmail);
  assert(data, 'Invalid email or password', 401);
  assert(data.status === 'active', 'User account is not active', 403);

  if (data.auth_user_id || data.password_hash === SUPABASE_AUTH_PLACEHOLDER) {
    if (!data.auth_user_id) {
      const authUser = await findAuthIdentityByEmail(data.email);
      assert(authUser, 'Authentication account is not linked correctly', 500);
      await linkAuthIdentityToLocalRecord({
        localId: data.id,
        authUserId: authUser.id
      });
    }

    const authSession = await signInWithSupabasePassword({
      email: data.email,
      password: normalizedPassword
    });

    await updateLastLogin(data.id);
    const user = await loadUserContextById(data.id);
    user.last_login_at = new Date().toISOString();
    return buildAuthResponse(user, authSession.session);
  }

  const isValidPassword = await verifyPassword(normalizedPassword, data.password_hash);
  assert(isValidPassword, 'Invalid email or password', 401);

  await ensureUserAuthIdentity(data, normalizedPassword);
  const authSession = await signInWithSupabasePassword({
    email: data.email,
    password: normalizedPassword
  });

  await updateLastLogin(data.id);
  const user = await loadUserContextById(data.id);
  user.last_login_at = new Date().toISOString();
  return buildAuthResponse(user, authSession.session);
};

export const logoutUser = async () => ({
  logged_out: true
});

export const getMe = async (userId) => loadUserContextById(userId);

export const updateMe = async (userId, payload) => {
  const existing = await getUserWithPrivateFieldsById(userId);
  assert(existing, 'User not found', 404);

  const names = normalizeNameFields(payload, {
    allowPartial: true
  });
  const updatePayload = {};

  if (names.first_name !== null) updatePayload.first_name = names.first_name;
  if (names.last_name !== null) updatePayload.last_name = names.last_name;
  if (payload.phone !== undefined) updatePayload.phone = normalizePhone(payload.phone);

  if (payload.email !== undefined) {
    const nextEmail = normalizeEmail(payload.email);
    await ensureEmailAvailable(nextEmail, existing.id);
    updatePayload.email = nextEmail;
  }

  const { error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', existing.id);

  throwIfError(error);

  if (existing.auth_user_id && updatePayload.email) {
    await updateAuthIdentity(existing.auth_user_id, {
      email: updatePayload.email,
      email_confirm: true
    });
  }

  return loadUserContextById(existing.id);
};

export const uploadProfileImage = async (userId, { image_base64, mime_type = null }) => {
  const user = await getUserWithPrivateFieldsById(userId);
  assert(user, 'User not found', 404);

  const { buffer, mimeType, extension } = parseBase64Image(image_base64, mime_type);
  await ensureProfileImageBucket();

  const objectPath = `${user.id}/${Date.now()}-${nanoid(10)}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(env.profileImageBucket)
    .upload(objectPath, buffer, {
      contentType: mimeType,
      upsert: false
    });

  throwIfError(uploadError, 'Unable to upload profile image', 500);

  const { data: publicUrlData } = supabase.storage
    .from(env.profileImageBucket)
    .getPublicUrl(objectPath);

  const { error: updateError } = await supabase
    .from('users')
    .update({
      profile_image_url: publicUrlData.publicUrl,
      profile_image_path: objectPath
    })
    .eq('id', user.id);

  throwIfError(updateError);

  return loadUserContextById(user.id);
};

export const createPasswordResetRequest = async ({ email }, { ipAddress = null, userAgent = null } = {}) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await getUserWithPrivateFieldsByEmail(normalizedEmail);

  const response = {
    sent: true,
    message: 'If the email exists, a password reset link has been created'
  };

  if (!user || user.status !== 'active') {
    return response;
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + (env.passwordResetExpiresMinutes * 60 * 1000)).toISOString();

  const { error: cleanupError } = await supabase
    .from('password_reset_tokens')
    .delete()
    .eq('user_id', user.id);

  throwIfError(cleanupError);

  const { error: insertError } = await supabase
    .from('password_reset_tokens')
    .insert([{
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      requested_ip: ipAddress,
      user_agent: userAgent
    }]);

  throwIfError(insertError);

  if (!env.isProduction) {
    response.debug = {
      reset_token: token,
      reset_url: `${env.passwordResetUrl}?token=${encodeURIComponent(token)}`,
      expires_at: expiresAt
    };
  }

  return response;
};

export const resetPassword = async ({ token, new_password }) => {
  const normalizedToken = normalizeString(token, {
    field: 'token',
    min: 32,
    max: 255,
    trim: true
  });
  const normalizedPassword = normalizeString(new_password, {
    field: 'new_password',
    min: env.minPasswordLength,
    max: 128,
    trim: false
  });

  const { data: resetRequest, error } = await supabase
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', hashResetToken(normalizedToken))
    .maybeSingle();

  throwIfError(error);
  assert(resetRequest, 'Invalid or expired reset token', 400);
  assert(!resetRequest.used_at, 'Invalid or expired reset token', 400);
  assert(new Date(resetRequest.expires_at).getTime() > Date.now(), 'Invalid or expired reset token', 400);

  const user = await getUserWithPrivateFieldsById(resetRequest.user_id);
  assert(user, 'User not found', 404);
  assert(user.status === 'active', 'User account is not active', 403);

  await ensureUserAuthIdentity(user, normalizedPassword);
  const passwordHash = await hashPassword(normalizedPassword);
  const now = new Date().toISOString();

  const { error: updateUserError } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash
    })
    .eq('id', user.id);

  throwIfError(updateUserError);

  const { error: resetUpdateError } = await supabase
    .from('password_reset_tokens')
    .update({
      used_at: now
    })
    .eq('id', resetRequest.id);

  throwIfError(resetUpdateError);

  return {
    reset: true,
    reset_at: now
  };
};

export const listUsers = async (query = {}) => {
  let builder = supabase
    .from('users')
    .select(USER_PRIVATE_COLUMNS)
    .order('created_at', { ascending: false });

  const email = normalizeEmail(query.email || '', { required: false });
  const status = normalizeUserStatus(query.status, { required: false });
  const userType = normalizeUserType(query.user_type, { required: false });
  const search = normalizeOptionalString(query.search, {
    field: 'search',
    min: 2,
    max: 120
  });

  if (email) builder = builder.eq('email', email);
  if (status) builder = builder.eq('status', status);
  if (userType) builder = builder.eq('user_type', userType);

  const { data, error } = await builder;
  throwIfError(error);

  let users = data || [];
  if (search) {
    const lowered = search.toLowerCase();
    users = users.filter((user) => {
      const haystack = [
        user.code,
        user.first_name,
        user.last_name,
        user.email,
        user.phone
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(lowered);
    });
  }

  return Promise.all(users.map((user) => buildUserContext(user)));
};

export const getManagedUserById = async (id) => {
  const user = await getUserWithPrivateFieldsById(normalizeUuidish(id, 'id'));
  assert(user, 'User not found', 404);
  return buildUserContext(user);
};

export const createManagedUser = async (payload) => {
  const names = normalizeNameFields(payload);
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const password = normalizeString(payload.password, {
    field: 'password',
    min: env.minPasswordLength,
    max: 128,
    trim: false
  });
  const role = await resolveRole({
    role_id: payload.role_id,
    role_code: payload.role_code || payload.role
  });
  const user_type = normalizeUserType(payload.user_type || role.code, {
    required: true
  });
  const status = normalizeUserStatus(payload.status || 'active', {
    required: true
  });

  await ensureEmailAvailable(email);

  const authUser = await createAuthIdentity({
    email,
    password,
    scope: 'app_user',
    metadata: {
      user_type
    }
  });
  assert(authUser, 'Email already exists', 409);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      code: normalizeOptionalString(payload.code, {
        field: 'code',
        min: 4,
        max: 40
      }) || generateUserCode(),
      role_id: role.id,
      user_type,
      first_name: names.first_name,
      last_name: names.last_name,
      email,
      phone,
      password_hash: SUPABASE_AUTH_PLACEHOLDER,
      auth_user_id: authUser.id,
      status
    }])
    .select(USER_PRIVATE_COLUMNS)
    .single();

  throwIfError(error);
  return buildUserContext(data);
};

export const updateManagedUser = async (id, payload) => {
  const existing = await getUserWithPrivateFieldsById(normalizeUuidish(id, 'id'));
  assert(existing, 'User not found', 404);

  const names = normalizeNameFields(payload, {
    allowPartial: true
  });
  const updatePayload = {};

  if (payload.code !== undefined) {
    updatePayload.code = normalizeString(payload.code, {
      field: 'code',
      min: 4,
      max: 40
    });
  }
  if (names.first_name !== null) updatePayload.first_name = names.first_name;
  if (names.last_name !== null) updatePayload.last_name = names.last_name;
  if (payload.phone !== undefined) updatePayload.phone = normalizePhone(payload.phone);
  if (payload.status !== undefined) updatePayload.status = normalizeUserStatus(payload.status, { required: true });
  if (payload.user_type !== undefined) updatePayload.user_type = normalizeUserType(payload.user_type, { required: true });

  if (payload.email !== undefined) {
    const email = normalizeEmail(payload.email);
    await ensureEmailAvailable(email, existing.id);
    updatePayload.email = email;
  }

  if (payload.role_id !== undefined || payload.role_code !== undefined || payload.role !== undefined) {
    const role = await resolveRole({
      role_id: payload.role_id,
      role_code: payload.role_code || payload.role
    });
    updatePayload.role_id = role.id;
  }

  const { error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', existing.id);

  throwIfError(error);

  if (existing.auth_user_id && (updatePayload.email || updatePayload.user_type)) {
    await updateAuthIdentity(existing.auth_user_id, {
      ...(updatePayload.email ? {
        email: updatePayload.email,
        email_confirm: true
      } : {}),
      ...(updatePayload.user_type ? {
        user_metadata: {
          user_type: updatePayload.user_type,
          local_user_id: existing.id
        }
      } : {})
    });
  }

  return getManagedUserById(existing.id);
};

export const resetManagedUserPassword = async (id, payload) => {
  const existing = await getUserWithPrivateFieldsById(normalizeUuidish(id, 'id'));
  assert(existing, 'User not found', 404);

  const password = normalizeString(payload.new_password || payload.password, {
    field: 'new_password',
    min: env.minPasswordLength,
    max: 128,
    trim: false
  });

  if (existing.auth_user_id) {
    await updateAuthIdentityPassword(existing.auth_user_id, password);
  } else {
    await ensureUserAuthIdentity(existing, password);
  }

  const passwordHash = await hashPassword(password);
  const { error } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash
    })
    .eq('id', existing.id);

  throwIfError(error);

  return {
    reset: true,
    user: sanitizeUser(existing)
  };
};
