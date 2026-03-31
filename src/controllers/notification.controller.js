import { createHandler as handle } from '../utils/controller.js';
import {
  createNotification,
  listNotifications,
  markNotificationRead
} from '../services/notification.service.js';

export const index = handle(listNotifications, 'Notifications loaded', {
  mapArgs: (req) => [req.query, req.user]
});

export const create = handle(createNotification, 'Notification created', {
  status: 201,
  mapArgs: (req) => [req.body, req.user]
});

export const read = handle(markNotificationRead, 'Notification marked as read', {
  mapArgs: (req) => [req.params.id, req.user]
});
