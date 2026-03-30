import { Router } from 'express';
import {
  forgotPassword,
  login,
  me,
  register,
  resetPasswordByToken,
  updateProfileImage
} from '../controllers/auth.controller.js';
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
router.post('/forgot-password', authRateLimit, forgotPassword);
router.post('/reset-password', authRateLimit, resetPasswordByToken);
router.get('/me', authRequired, me);
router.post('/profile/image', authRequired, updateProfileImage);
export default router;
