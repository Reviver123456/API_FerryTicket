import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);
const HASH_PREFIX = 'scrypt';
const HASH_KEY_LENGTH = 64;

const toBuffer = (value) => Buffer.from(value, 'hex');

export const isHashedPassword = (value = '') => value.startsWith(`${HASH_PREFIX}$`);

export const hashPassword = async (password) => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, HASH_KEY_LENGTH);
  return `${HASH_PREFIX}$${salt}$${Buffer.from(derivedKey).toString('hex')}`;
};

export const verifyPassword = async (password, storedPassword) => {
  if (!storedPassword) return false;

  if (!isHashedPassword(storedPassword)) {
    return password === storedPassword;
  }

  const [, salt, storedHash] = storedPassword.split('$');
  if (!salt || !storedHash) return false;

  const derivedKey = await scrypt(password, salt, HASH_KEY_LENGTH);
  const derivedBuffer = Buffer.from(derivedKey);
  const storedBuffer = toBuffer(storedHash);

  if (derivedBuffer.length !== storedBuffer.length) return false;
  return timingSafeEqual(derivedBuffer, storedBuffer);
};

export const needsPasswordRehash = (storedPassword) => !isHashedPassword(storedPassword);
