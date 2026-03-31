import { Router } from 'express';
import { createDraft, mine, show, update, expireDrafts } from '../controllers/booking.controller.js';
import { authOptional, authRequired } from '../middleware/authMiddleware.js';
import { internalApiKeyRequired } from '../middleware/internalAuth.js';

const router = Router();
router.post('/draft', authOptional, createDraft);
router.get('/my', authRequired, mine);
router.get('/me', authRequired, mine);
router.get('/:bookingNo', show);
router.put('/:bookingNo', update);
router.post('/jobs/expire-stale', internalApiKeyRequired, expireDrafts);
export default router;
