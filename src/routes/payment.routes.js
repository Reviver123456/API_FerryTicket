import { Router } from 'express';
import {
  confirm,
  create,
  index,
  refund,
  show,
  webhook
} from '../controllers/payment.controller.js';
import { authOptional, authRequired, permissionRequired } from '../middleware/authMiddleware.js';
import { webhookSecretRequired } from '../middleware/internalAuth.js';

const router = Router();
router.post('/', authOptional, create);
router.get('/', authRequired, index);
router.post('/webhook/callback', webhookSecretRequired, webhook);
router.get('/:paymentRef', authOptional, show);
router.post('/:paymentRef/confirm', authRequired, permissionRequired('payments.manage'), confirm);
router.post('/:paymentRef/refund', authRequired, permissionRequired('payments.refund'), refund);
export default router;
