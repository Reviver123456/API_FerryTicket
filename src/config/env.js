import dotenv from 'dotenv';
dotenv.config();

const parseNumber = (value, fallback) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const parseCsv = (value) => (value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const supabaseServerKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const required = [
  ['SUPABASE_URL', process.env.SUPABASE_URL],
  ['SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY', supabaseServerKey],
  ['PAYMENT_WEBHOOK_SECRET', process.env.PAYMENT_WEBHOOK_SECRET],
  ['INTERNAL_API_KEY', process.env.INTERNAL_API_KEY]
];

for (const [label, value] of required) {
  if (!value) {
    const message = `[ENV] Missing required env: ${label}`;
    if (isProduction) {
      throw new Error(message);
    }

    console.warn(message);
  }
}

const insecureDefaults = ['change_me', 'test_secret', 'development_only'];
const assertSecureValue = (label, value) => {
  if (!value) return;
  if (insecureDefaults.includes(value) || value.length < 16) {
    const message = `[ENV] ${label} must be set to a secure value`;
    if (isProduction) {
      throw new Error(message);
    }

    console.warn(message);
  }
};

assertSecureValue('PAYMENT_WEBHOOK_SECRET', process.env.PAYMENT_WEBHOOK_SECRET);
assertSecureValue('INTERNAL_API_KEY', process.env.INTERNAL_API_KEY);

export const env = {
  port: parseNumber(process.env.PORT, 3000),
  nodeEnv,
  isProduction,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  passwordResetUrl: process.env.PASSWORD_RESET_URL || `${process.env.APP_URL || 'http://localhost:3000'}/reset-password`,
  adminPasswordResetUrl: process.env.ADMIN_PASSWORD_RESET_URL || `${process.env.APP_URL || 'http://localhost:3000'}/admin/reset-password`,
  passwordResetExpiresMinutes: parseNumber(process.env.PASSWORD_RESET_EXPIRES_MINUTES, 30),
  profileImageBucket: process.env.PROFILE_IMAGE_BUCKET || 'profile-images',
  profileImageMaxBytes: parseNumber(process.env.PROFILE_IMAGE_MAX_BYTES, 5 * 1024 * 1024),
  mockPaymentAutoSuccess: parseBoolean(process.env.MOCK_PAYMENT_AUTO_SUCCESS, false),
  jwtSecret: process.env.JWT_SECRET || 'change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServerKey,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  bookingHoldMinutes: parseNumber(process.env.BOOKING_HOLD_MINUTES, 15),
  bookingExpiryJobEnabled: parseBoolean(process.env.BOOKING_EXPIRY_JOB_ENABLED, true),
  bookingExpiryJobIntervalMs: parseNumber(process.env.BOOKING_EXPIRY_JOB_INTERVAL_MS, 60 * 1000),
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'change_me',
  internalApiKey: process.env.INTERNAL_API_KEY || '',
  timezone: process.env.DEFAULT_TIMEZONE || 'Asia/Bangkok',
  corsOrigins: parseCsv(process.env.CORS_ORIGINS),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '1mb',
  trustProxy: parseBoolean(process.env.TRUST_PROXY, isProduction),
  rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMaxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 300),
  authRateLimitMaxRequests: parseNumber(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 20),
  minPasswordLength: parseNumber(process.env.MIN_PASSWORD_LENGTH, 8)
};
