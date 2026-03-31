import { Router } from 'express';
import {
  permissions,
  roleCreate,
  roleUpdate,
  roles
} from '../controllers/role.controller.js';
import { authRequired, permissionRequired } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/roles', authRequired, permissionRequired('roles.view'), roles);
router.post('/roles', authRequired, permissionRequired('roles.manage'), roleCreate);
router.put('/roles/:code', authRequired, permissionRequired('roles.manage'), roleUpdate);
router.get('/permissions', authRequired, permissionRequired('roles.view'), permissions);

export default router;
