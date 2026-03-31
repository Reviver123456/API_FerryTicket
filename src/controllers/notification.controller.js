import { sendNotification } from '../services/notification.service.js';
import { createHandler as handle } from '../utils/controller.js';

export const send = handle(sendNotification, 'Notification sent', {
  status: 201
});
