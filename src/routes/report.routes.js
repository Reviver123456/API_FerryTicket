import { Router } from 'express';
import {
  dashboard,
  passengers,
  sales
} from '../controllers/report.controller.js';
import { authRequired, permissionRequired } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/dashboard', authRequired, permissionRequired('dashboard.view'), dashboard);
router.get('/reports/sales', authRequired, permissionRequired('reports.view'), sales);
router.get('/reports/passengers', authRequired, permissionRequired('reports.view'), passengers);

export default router;
