import { Router } from 'express';
import {
  adminForgotPassword,
  adminLogin,
  adminMe,
  adminResetPassword,
  agentCreate,
  agentSales,
  agentUpdate,
  agents,
  agentPriceCreate,
  agentPriceUpdate,
  agentPrices,
  bookingCancel,
  bookingDetail,
  bookingMarkPaid,
  bookingRefund,
  bookingReschedule,
  bookingResend,
  bookingUpdate,
  bookings,
  dashboard,
  gateScan,
  gateSearch,
  notificationCreate,
  notificationRead,
  notifications,
  paymentConfirm,
  paymentDetail,
  paymentRefund,
  payments,
  permissionsCatalog,
  posSale,
  pricePreview,
  reportPassengers,
  reportSales,
  roleCreate,
  roleUpdate,
  roles,
  scheduleCancel,
  scheduleClose,
  scheduleCreate,
  scheduleDetail,
  scheduleOpen,
  scheduleUpdate,
  schedules,
  settings,
  settingsExport,
  settingsImport,
  settingsUpdate,
  standardPriceCreate,
  standardPriceUpdate,
  standardPrices,
  ticketTypeCreate,
  ticketTypeUpdate,
  ticketTypes,
  userCreate,
  userResetPassword,
  userUpdate,
  users
} from '../controllers/admin.controller.js';
import { adminAuthRequired, adminPermissionRequired } from '../middleware/adminAuthMiddleware.js';

const router = Router();

router.post('/auth/login', adminLogin);
router.post('/auth/forgot-password', adminForgotPassword);
router.post('/auth/reset-password', adminResetPassword);

router.use(adminAuthRequired);

router.get('/auth/me', adminMe);
router.get('/permissions', permissionsCatalog);

router.get('/dashboard', adminPermissionRequired('dashboard.view'), dashboard);

router.get('/schedules', adminPermissionRequired('schedules.view'), schedules);
router.get('/schedules/:id', adminPermissionRequired('schedules.view'), scheduleDetail);
router.post('/schedules', adminPermissionRequired('schedules.manage'), scheduleCreate);
router.put('/schedules/:id', adminPermissionRequired('schedules.manage'), scheduleUpdate);
router.post('/schedules/:id/open-sales', adminPermissionRequired('schedules.manage'), scheduleOpen);
router.post('/schedules/:id/close-sales', adminPermissionRequired('schedules.manage'), scheduleClose);
router.post('/schedules/:id/cancel', adminPermissionRequired('schedules.manage'), scheduleCancel);

router.get('/ticket-types', adminPermissionRequired('ticket_types.view'), ticketTypes);
router.post('/ticket-types', adminPermissionRequired('ticket_types.manage'), ticketTypeCreate);
router.put('/ticket-types/:id', adminPermissionRequired('ticket_types.manage'), ticketTypeUpdate);

router.get('/prices/standard', adminPermissionRequired('prices.view'), standardPrices);
router.post('/prices/standard', adminPermissionRequired('prices.manage'), standardPriceCreate);
router.put('/prices/standard/:id', adminPermissionRequired('prices.manage'), standardPriceUpdate);
router.get('/prices/agent', adminPermissionRequired('prices.view'), agentPrices);
router.post('/prices/agent', adminPermissionRequired('prices.manage'), agentPriceCreate);
router.put('/prices/agent/:id', adminPermissionRequired('prices.manage'), agentPriceUpdate);
router.get('/prices/preview', adminPermissionRequired('prices.view'), pricePreview);

router.get('/bookings', adminPermissionRequired('bookings.view'), bookings);
router.get('/bookings/:bookingNo', adminPermissionRequired('bookings.view'), bookingDetail);
router.put('/bookings/:bookingNo', adminPermissionRequired('bookings.manage'), bookingUpdate);
router.post('/bookings/:bookingNo/change-schedule', adminPermissionRequired('bookings.reschedule'), bookingReschedule);
router.post('/bookings/:bookingNo/cancel', adminPermissionRequired('bookings.cancel'), bookingCancel);
router.post('/bookings/:bookingNo/mark-paid', adminPermissionRequired('payments.manage'), bookingMarkPaid);
router.post('/bookings/:bookingNo/resend-tickets', adminPermissionRequired('tickets.resend'), bookingResend);
router.post('/bookings/:bookingNo/refund', adminPermissionRequired('payments.refund'), bookingRefund);

router.post('/pos/sales', adminPermissionRequired('pos.sell'), posSale);

router.get('/gate/search', adminPermissionRequired('gate.scan'), gateSearch);
router.post('/gate/scan', adminPermissionRequired('gate.scan'), gateScan);

router.get('/payments', adminPermissionRequired('payments.view'), payments);
router.get('/payments/:paymentRef', adminPermissionRequired('payments.view'), paymentDetail);
router.post('/payments/:paymentRef/confirm', adminPermissionRequired('payments.manage'), paymentConfirm);
router.post('/payments/:paymentRef/refund', adminPermissionRequired('payments.refund'), paymentRefund);

router.get('/reports/sales', adminPermissionRequired('reports.view'), reportSales);
router.get('/reports/passengers', adminPermissionRequired('reports.view'), reportPassengers);

router.get('/users', adminPermissionRequired('users.view'), users);
router.post('/users', adminPermissionRequired('users.manage'), userCreate);
router.put('/users/:id', adminPermissionRequired('users.manage'), userUpdate);
router.post('/users/:id/reset-password', adminPermissionRequired('users.manage'), userResetPassword);

router.get('/roles', adminPermissionRequired('roles.view'), roles);
router.post('/roles', adminPermissionRequired('roles.manage'), roleCreate);
router.put('/roles/:code', adminPermissionRequired('roles.manage'), roleUpdate);

router.get('/agents', adminPermissionRequired('agents.view'), agents);
router.post('/agents', adminPermissionRequired('agents.manage'), agentCreate);
router.put('/agents/:id', adminPermissionRequired('agents.manage'), agentUpdate);
router.get('/agents/:id/sales', adminPermissionRequired('agents.view'), agentSales);

router.get('/notifications', adminPermissionRequired('notifications.view'), notifications);
router.post('/notifications', adminPermissionRequired('notifications.manage'), notificationCreate);
router.post('/notifications/:id/read', adminPermissionRequired('notifications.view'), notificationRead);

router.get('/settings', adminPermissionRequired('settings.view'), settings);
router.put('/settings', adminPermissionRequired('settings.manage'), settingsUpdate);
router.get('/settings/export', adminPermissionRequired('settings.view'), settingsExport);
router.post('/settings/import', adminPermissionRequired('settings.manage'), settingsImport);

export default router;
