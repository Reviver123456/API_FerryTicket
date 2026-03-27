import { Router } from 'express';
import { send } from '../controllers/notification.controller.js';
import { internalApiKeyRequired } from '../middleware/internalAuth.js';

const router = Router();
router.post('/send', internalApiKeyRequired, send);
export default router;
