import { assert } from '../services/base.service.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-() ]{7,20}$/;
const UUIDISH_REGEX = /^[0-9a-fA-F-]{8,}$/;

export const normalizeString = (value, {
  field = 'value',
  min = 1,
  max = 255,
  required = true,
  trim = true
} = {}) => {
  if (value === undefined || value === null) {
    assert(!required, `${field} is required`);
    return null;
  }

  assert(typeof value === 'string', `${field} must be a string`);
  const normalized = trim ? value.trim() : value;
  assert(normalized.length >= min, `${field} must be at least ${min} characters`);
  assert(normalized.length <= max, `${field} must be at most ${max} characters`);
  return normalized;
};

export const normalizeOptionalString = (value, options = {}) => {
  if (value === undefined || value === null || value === '') return null;
  return normalizeString(value, { ...options, required: false });
};

export const normalizeEmail = (value, { required = true } = {}) => {
  const email = required
    ? normalizeString(value, { field: 'email', min: 5, max: 255 })
    : normalizeOptionalString(value, { field: 'email', min: 5, max: 255 });

  if (!email) return null;

  const normalized = email.toLowerCase();
  assert(EMAIL_REGEX.test(normalized), 'email is invalid');
  return normalized;
};

export const normalizePhone = (value, { required = false } = {}) => {
  const phone = required
    ? normalizeString(value, { field: 'phone', min: 7, max: 20 })
    : normalizeOptionalString(value, { field: 'phone', min: 7, max: 20 });

  if (!phone) return null;

  assert(PHONE_REGEX.test(phone), 'phone is invalid');
  return phone;
};

export const normalizePositiveInteger = (value, field) => {
  const normalized = Number(value);
  assert(Number.isInteger(normalized) && normalized > 0, `${field} must be a positive integer`);
  return normalized;
};

export const normalizeNonNegativeNumber = (value, field) => {
  const normalized = Number(value);
  assert(Number.isFinite(normalized) && normalized >= 0, `${field} must be a non-negative number`);
  return normalized;
};

export const normalizeEnum = (value, allowedValues, field) => {
  const normalized = normalizeString(value, { field });
  assert(allowedValues.includes(normalized), `${field} is invalid`);
  return normalized;
};

export const normalizeUuidish = (value, field) => {
  const normalized = normalizeString(value, { field, min: 8, max: 64 });
  assert(UUIDISH_REGEX.test(normalized), `${field} is invalid`);
  return normalized;
};

export const assertNonEmptyArray = (value, field) => {
  assert(Array.isArray(value) && value.length > 0, `${field} must be a non-empty array`);
};
