import { Router } from 'express';
import { validate } from '../controllers/gate.controller.js';
import { internalApiKeyRequired } from '../middleware/internalAuth.js';

const router = Router();
router.post('/validate', internalApiKeyRequired, validate);
export default router;
