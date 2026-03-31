import { Router } from 'express';
import {
  create,
  index,
  preview,
  show,
  update
} from '../controllers/price.controller.js';
import { authRequired, permissionRequired } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/preview', authRequired, permissionRequired('prices.view'), preview);
router.get('/', authRequired, permissionRequired('prices.view'), index);
router.get('/:id', authRequired, permissionRequired('prices.view'), show);
router.post('/', authRequired, permissionRequired('prices.manage'), create);
router.put('/:id', authRequired, permissionRequired('prices.manage'), update);

export default router;
