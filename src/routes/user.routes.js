import { Router } from 'express';
import {
  create,
  index,
  resetPassword,
  show,
  update
} from '../controllers/user.controller.js';
import { authRequired, permissionRequired } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', authRequired, permissionRequired('users.view'), index);
router.post('/', authRequired, permissionRequired('users.manage'), create);
router.get('/:id', authRequired, permissionRequired('users.view'), show);
router.put('/:id', authRequired, permissionRequired('users.manage'), update);
router.post('/:id/reset-password', authRequired, permissionRequired('users.manage'), resetPassword);

export default router;
