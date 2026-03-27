import { fail } from '../utils/http.js';

const buckets = new Map();

const cleanupBuckets = () => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

setInterval(cleanupBuckets, 60_000).unref();

export const createRateLimiter = ({
  keyPrefix = 'global',
  windowMs,
  maxRequests,
  message = 'Too many requests'
}) => (req, res, next) => {
  const now = Date.now();
  const key = `${keyPrefix}:${req.ip}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  current.count += 1;

  if (current.count > maxRequests) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return fail(res, message, 429);
  }

  next();
};
