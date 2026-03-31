import { Router } from 'express';
import {
  exportData,
  importData,
  index,
  update
} from '../controllers/settings.controller.js';
import { authRequired, permissionRequired } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', authRequired, permissionRequired('settings.view'), index);
router.put('/', authRequired, permissionRequired('settings.manage'), update);
router.get('/export', authRequired, permissionRequired('settings.view'), exportData);
router.post('/import', authRequired, permissionRequired('settings.manage'), importData);

export default router;
