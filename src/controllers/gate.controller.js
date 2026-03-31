import { validateGateScan } from '../services/gate.service.js';
import { createHandler as handle } from '../utils/controller.js';

export const validate = handle(validateGateScan, 'Gate validation completed');
