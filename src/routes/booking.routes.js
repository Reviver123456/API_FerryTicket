import { Router } from 'express';
import { createDraft, show, update, expireDrafts } from '../controllers/booking.controller.js';
import { internalApiKeyRequired } from '../middleware/internalAuth.js';

const router = Router();
router.post('/draft', createDraft);
router.get('/:bookingNo', show);
router.put('/:bookingNo', update);
router.post('/jobs/expire-stale', internalApiKeyRequired, expireDrafts);
export default router;
