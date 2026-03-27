import { sendNotification } from '../services/notification.service.js';
import { ok } from '../utils/http.js';

export const send = async (req, res, next) => {
  try {
    const data = await sendNotification(req.body);
    return ok(res, data, 'Notification sent', 201);
  } catch (error) {
    next(error);
  }
};
