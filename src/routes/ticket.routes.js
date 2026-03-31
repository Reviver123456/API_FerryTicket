import { Router } from 'express';
import {
  index,
  resend,
  show
} from '../controllers/ticket.controller.js';
import { authOptional, authRequired } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', authRequired, index);
router.get('/:ticketNo', authOptional, show);
router.post('/resend', authOptional, resend);

export default router;
