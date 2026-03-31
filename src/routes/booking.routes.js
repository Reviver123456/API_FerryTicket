import { Router } from 'express';
import { createDraft, mine, show, update, expireDrafts } from '../controllers/booking.controller.js';
import { authOptional, authRequired } from '../middleware/authMiddleware.js';
import { internalApiKeyRequired } from '../middleware/internalAuth.js';

const router = Router();

router.post('/draft', authOptional, createDraft);
router.get(['/my', '/me'], authRequired, mine);
router.route('/:bookingNo')
  .get(show)
  .put(update);
router.post('/jobs/expire-stale', internalApiKeyRequired, expireDrafts);
export default router;
