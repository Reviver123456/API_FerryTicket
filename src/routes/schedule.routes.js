import { Router } from 'express';
import {
  cancel,
  closeSales,
  create,
  index,
  openSales,
  show,
  update
} from '../controllers/schedule.controller.js';
import { authRequired, permissionRequired } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', index);
router.get('/:id', show);
router.post('/', authRequired, permissionRequired('schedules.manage'), create);
router.put('/:id', authRequired, permissionRequired('schedules.manage'), update);
router.post('/:id/open-sales', authRequired, permissionRequired('schedules.manage'), openSales);
router.post('/:id/close-sales', authRequired, permissionRequired('schedules.manage'), closeSales);
router.post('/:id/cancel', authRequired, permissionRequired('schedules.manage'), cancel);

export default router;
