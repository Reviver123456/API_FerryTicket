import { Router } from 'express';
import {
  create,
  index,
  read
} from '../controllers/notification.controller.js';
import { authOptional, authRequired, permissionRequired } from '../middleware/authMiddleware.js';
import { hasValidInternalApiKey } from '../middleware/internalAuth.js';
import { fail } from '../utils/http.js';

const router = Router();

const notificationCreateAccessRequired = (req, res, next) => {
  if (hasValidInternalApiKey(req)) {
    return next();
  }

  if (!req.user) {
    return fail(res, 'Unauthorized', 401);
  }

  return permissionRequired('notifications.manage')(req, res, next);
};

router.get('/', authRequired, index);
router.post('/', authOptional, notificationCreateAccessRequired, create);
router.post('/:id/read', authRequired, read);

export default router;
