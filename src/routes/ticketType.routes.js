import { Router } from 'express';
import {
  create,
  index,
  show,
  update
} from '../controllers/ticketType.controller.js';
import { authRequired, permissionRequired } from '../middleware/authMiddleware.js';

const router = Router();
router.get('/', index);
router.get('/:id', show);
router.post('/', authRequired, permissionRequired('ticket_types.manage'), create);
router.put('/:id', authRequired, permissionRequired('ticket_types.manage'), update);
export default router;
