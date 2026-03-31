import { Router } from 'express';
import {
  create,
  index,
  show
} from '../controllers/pos.controller.js';
import { authRequired, permissionRequired } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/sales', authRequired, permissionRequired('pos.sell'), create);
router.get('/sales', authRequired, permissionRequired('pos.sell'), index);
router.get('/sales/:id', authRequired, permissionRequired('pos.sell'), show);

export default router;
