import { Router } from 'express';
import {
  create,
  index,
  sales,
  update
} from '../controllers/agent.controller.js';
import { authRequired, permissionRequired } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', authRequired, permissionRequired('agents.view'), index);
router.post('/', authRequired, permissionRequired('agents.manage'), create);
router.put('/:id', authRequired, permissionRequired('agents.manage'), update);
router.get('/:id/sales', authRequired, permissionRequired('agents.view'), sales);

export default router;
