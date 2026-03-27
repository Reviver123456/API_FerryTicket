import { Router } from 'express';
import { login, me, register } from '../controllers/auth.controller.js';
import { authRequired } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { env } from '../config/env.js';

const router = Router();
const authRateLimit = createRateLimiter({
  keyPrefix: 'auth',
  windowMs: env.rateLimitWindowMs,
  maxRequests: env.authRateLimitMaxRequests,
  message: 'Too many authentication attempts'
});

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);
router.get('/me', authRequired, me);
export default router;
