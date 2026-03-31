import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { throwIfError, assert } from './base.service.js';
import { verifyPassword } from '../utils/password.js';
import { normalizeEmail, normalizePhone, normalizeString } from '../utils/validation.js';
import { createHash, randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';
import {
  createAuthIdentity,
  findAuthIdentityByEmail,
  linkAuthIdentityToLocalRecord,
  signInWithSupabasePassword,
  SUPABASE_AUTH_PLACEHOLDER,
  updateAuthIdentityPassword
} from './supabaseAuth.service.js';

const PUBLIC_USER_COLUMNS = 'id, full_name, phone, email, profile_image_url, status, created_at, updated_at';
const PROFILE_IMAGE_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

let profileBucketReady = false;

const sanitizeUser = ({ password, auth_user_id, ...user }) => user;

const hashResetToken = (token) => createHash('sha256').update(token).digest('hex');

const buildAuthResponse = (user, session) => ({
  user: sanitizeUser(user),
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

const ensureCustomerAuthIdentity = async (user, password) => {
  let authUser = user.auth_user_id
    ? { id: user.auth_user_id, email: user.email }
    : await createAuthIdentity({
      email: user.email,
      password,
      scope: 'customer',
      metadata: {
        local_user_id: user.id
      }
    });

  if (!authUser) {
    authUser = await findAuthIdentityByEmail(user.email);
  }

  assert(authUser, 'Unable to provision authentication account', 500);
  await updateAuthIdentityPassword(authUser.id, password);
  await linkAuthIdentityToLocalRecord({
    table: 'users',
    localId: user.id,
    authUserId: authUser.id
  });

  return authUser;
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

  const authUser = await createAuthIdentity({
    email: normalizedUser.email,
    password: normalizedUser.password,
    scope: 'customer'
  });
  assert(authUser, 'Email already exists', 409);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      full_name: normalizedUser.full_name,
      phone: normalizedUser.phone,
      email: normalizedUser.email,
      password: SUPABASE_AUTH_PLACEHOLDER,
      auth_user_id: authUser.id
    }])
    .select(PUBLIC_USER_COLUMNS)
    .single();

  throwIfError(error);

  const authSession = await signInWithSupabasePassword({
    email: normalizedUser.email,
    password: normalizedUser.password
  });

  return buildAuthResponse(data, authSession.session);
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
    .select(`${PUBLIC_USER_COLUMNS}, password, auth_user_id`)
    .eq('email', normalizedEmail)
    .maybeSingle();

  throwIfError(error);
  assert(data, 'Invalid email or password', 401);
  assert(data.status === 'active', 'User account is not active', 403);

  if (data.auth_user_id || data.password === SUPABASE_AUTH_PLACEHOLDER) {
    if (!data.auth_user_id) {
      const authUser = await findAuthIdentityByEmail(data.email);
      assert(authUser, 'Authentication account is not linked correctly', 500);
      await linkAuthIdentityToLocalRecord({
        table: 'users',
        localId: data.id,
        authUserId: authUser.id
      });
    }

    const authSession = await signInWithSupabasePassword({
      email: data.email,
      password: normalizedPassword
    });

    return buildAuthResponse(data, authSession.session);
  }

  const isValidPassword = await verifyPassword(normalizedPassword, data.password);
  assert(isValidPassword, 'Invalid email or password', 401);

  await ensureCustomerAuthIdentity(data, normalizedPassword);
  const authSession = await signInWithSupabasePassword({
    email: data.email,
    password: normalizedPassword
  });

  return buildAuthResponse(data, authSession.session);
};

export const getMe = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, phone, email, profile_image_url, status, created_at, updated_at')
    .eq('id', userId)
    .single();

  throwIfError(error);
  return data;
};

export const createPasswordResetRequest = async ({ email }, { ipAddress = null, userAgent = null } = {}) => {
  const normalizedEmail = normalizeEmail(email);
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, status')
    .eq('email', normalizedEmail)
    .maybeSingle();

  throwIfError(error);

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

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, status, auth_user_id')
    .eq('id', resetRequest.user_id)
    .single();

  throwIfError(userError);
  assert(user.status === 'active', 'User account is not active', 403);

  await ensureCustomerAuthIdentity(user, normalizedPassword);
  const now = new Date().toISOString();

  const { error: markUsedError } = await supabase
    .from('password_reset_tokens')
    .update({ used_at: now })
    .eq('user_id', user.id)
    .is('used_at', null);

  throwIfError(markUsedError);

  return {
    reset: true
  };
};

export const uploadProfileImage = async (userId, { image_base64, mime_type, file_name }) => {
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('id, profile_image_path, profile_image_url')
    .eq('id', userId)
    .single();

  throwIfError(userError);

  const { buffer, mimeType, extension } = parseBase64Image(image_base64, mime_type);
  await ensureProfileImageBucket();

  const normalizedFileName = file_name
    ? normalizeString(file_name, { field: 'file_name', min: 1, max: 255 })
    : `profile.${extension}`;
  const safeBaseName = normalizedFileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'profile';
  const filePath = `${userId}/${Date.now()}-${safeBaseName}-${nanoid(8)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(env.profileImageBucket)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false
    });

  throwIfError(uploadError, 'Unable to upload profile image', 500);

  const {
    data: { publicUrl }
  } = supabase.storage
    .from(env.profileImageBucket)
    .getPublicUrl(filePath);

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({
      profile_image_url: publicUrl,
      profile_image_path: filePath
    })
    .eq('id', userId)
    .select(PUBLIC_USER_COLUMNS)
    .single();

  if (updateError) {
    await supabase.storage.from(env.profileImageBucket).remove([filePath]);
    throwIfError(updateError);
  }

  if (existingUser.profile_image_path) {
    await supabase.storage.from(env.profileImageBucket).remove([existingUser.profile_image_path]);
  }

  return {
    user: sanitizeUser(updatedUser),
    profile_image_url: publicUrl
  };
};
