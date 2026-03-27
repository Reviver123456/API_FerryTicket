import { Router } from 'express';
import { byBooking, resend } from '../controllers/ticket.controller.js';
import { internalApiKeyRequired } from '../middleware/internalAuth.js';

const router = Router();
router.get('/booking/:bookingNo', byBooking);
router.post('/resend', internalApiKeyRequired, resend);
export default router;
