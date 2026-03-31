import { Router } from 'express';
import {
  cancel,
  changeSchedule,
  createDraft,
  expireDrafts,
  index,
  markPaid,
  passengers,
  passengersReplace,
  refund,
  resend,
  show,
  update
} from '../controllers/booking.controller.js';
import { authOptional, authRequired, permissionRequired } from '../middleware/authMiddleware.js';
import { internalApiKeyRequired } from '../middleware/internalAuth.js';

const router = Router();

router.post('/draft', authOptional, createDraft);
router.get('/', authRequired, index);
router.get('/:bookingNo', authOptional, show);
router.put('/:bookingNo', authOptional, update);
router.get('/:bookingNo/passengers', authOptional, passengers);
router.put('/:bookingNo/passengers', authOptional, passengersReplace);
router.post('/:bookingNo/cancel', authOptional, cancel);
router.post('/:bookingNo/change-schedule', authOptional, changeSchedule);
router.post('/:bookingNo/mark-paid', authRequired, permissionRequired('payments.manage'), markPaid);
router.post('/:bookingNo/resend-tickets', authOptional, resend);
router.post('/:bookingNo/refund', authRequired, permissionRequired('payments.refund'), refund);
router.post('/jobs/expire-stale', internalApiKeyRequired, expireDrafts);
export default router;
