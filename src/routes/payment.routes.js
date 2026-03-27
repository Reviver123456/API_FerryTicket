import { Router } from 'express';
import { create, show, webhook } from '../controllers/payment.controller.js';
import { webhookSecretRequired } from '../middleware/internalAuth.js';

const router = Router();
router.post('/', create);
router.get('/:paymentRef', show);
router.post('/webhook/callback', webhookSecretRequired, webhook);
export default router;
