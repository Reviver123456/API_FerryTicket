import { validateGateScan } from '../services/gate.service.js';
import { ok } from '../utils/http.js';

export const validate = async (req, res, next) => {
  try {
    const data = await validateGateScan(req.body);
    return ok(res, data, 'Gate validation completed');
  } catch (error) {
    next(error);
  }
};
