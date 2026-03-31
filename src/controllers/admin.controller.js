import { createHandler } from '../utils/controller.js';
import {
  adminPermissionsCatalog,
  cancelBooking,
  cancelSchedule,
  changeBookingSchedule,
  closeScheduleSales,
  confirmPaymentManually,
  createAdminPasswordResetRequest,
  createAdminTicketType,
  createAdminUser,
  createAgent,
  createAgentPriceRule,
  createNotificationEntry,
  createRole,
  createStandardPriceRule,
  createWalkInSale,
  createAdminSchedule,
  exportSystemSettings,
  getAdminBookingDetail,
  getAdminMe,
  getAdminPaymentDetail,
  getAdminSchedule,
  getAgentSalesSummary,
  getDashboard,
  getPassengerReport,
  getSalesReport,
  importSystemSettings,
  listAdminBookings,
  listAdminPayments,
  listAdminSchedules,
  listAdminTicketTypes,
  listAdminUsers,
  listAgents,
  listAgentPriceRules,
  listNotificationsCenter,
  listRoles,
  listStandardPriceRules,
  listSystemSettings,
  loginAdmin,
  markBookingPaid,
  markNotificationRead,
  openScheduleSales,
  previewResolvedPrice,
  refundBooking,
  refundPaymentManually,
  resendBookingTicketsAdmin,
  resetAdminPassword,
  resetManagedAdminPassword,
  scanTicket,
  searchTickets,
  updateAdminBooking,
  updateAdminSchedule,
  updateAdminTicketType,
  updateAdminUser,
  updateAgent,
  updateAgentPriceRule,
  updateRole,
  updateStandardPriceRule,
  updateSystemSettings
} from '../services/admin.service.js';

const handle = (service, message, options = {}) => createHandler(service, message, {
  mapArgs: (req) => [req.body, req.admin],
  ...options
});

export const adminLogin = handle(loginAdmin, 'Admin login successful', {
  mapArgs: (req) => [req.body, {
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null
  }]
});

export const adminForgotPassword = handle(createAdminPasswordResetRequest, 'Password reset requested', {
  mapArgs: (req) => [req.body, {
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null
  }]
});

export const adminResetPassword = handle(resetAdminPassword, 'Password reset successful');
export const adminMe = handle(getAdminMe, 'Admin profile loaded', {
  mapArgs: (req) => [req.admin.id]
});
export const permissionsCatalog = handle(adminPermissionsCatalog, 'Permissions loaded', {
  mapArgs: () => []
});

export const dashboard = handle(getDashboard, 'Dashboard loaded', {
  mapArgs: (req) => [req.query]
});

export const schedules = handle(listAdminSchedules, 'Schedules loaded', {
  mapArgs: (req) => [req.query]
});
export const scheduleDetail = handle(getAdminSchedule, 'Schedule loaded', {
  mapArgs: (req) => [req.params.id]
});
export const scheduleCreate = handle(createAdminSchedule, 'Schedule created', {
  status: 201
});
export const scheduleUpdate = handle(updateAdminSchedule, 'Schedule updated', {
  mapArgs: (req) => [req.params.id, req.body, req.admin]
});
export const scheduleOpen = handle(openScheduleSales, 'Schedule opened', {
  mapArgs: (req) => [req.params.id, req.admin]
});
export const scheduleClose = handle(closeScheduleSales, 'Schedule closed', {
  mapArgs: (req) => [req.params.id, req.admin]
});
export const scheduleCancel = handle(cancelSchedule, 'Schedule cancelled', {
  mapArgs: (req) => [req.params.id, req.body, req.admin]
});

export const ticketTypes = handle(listAdminTicketTypes, 'Ticket types loaded', {
  mapArgs: () => []
});
export const ticketTypeCreate = handle(createAdminTicketType, 'Ticket type created', {
  status: 201
});
export const ticketTypeUpdate = handle(updateAdminTicketType, 'Ticket type updated', {
  mapArgs: (req) => [req.params.id, req.body, req.admin]
});

export const standardPrices = handle(listStandardPriceRules, 'Standard prices loaded', {
  mapArgs: (req) => [req.query]
});
export const standardPriceCreate = handle(createStandardPriceRule, 'Standard price created', {
  status: 201
});
export const standardPriceUpdate = handle(updateStandardPriceRule, 'Standard price updated', {
  mapArgs: (req) => [req.params.id, req.body, req.admin]
});

export const agentPrices = handle(listAgentPriceRules, 'Agent prices loaded', {
  mapArgs: (req) => [req.query]
});
export const agentPriceCreate = handle(createAgentPriceRule, 'Agent price created', {
  status: 201
});
export const agentPriceUpdate = handle(updateAgentPriceRule, 'Agent price updated', {
  mapArgs: (req) => [req.params.id, req.body, req.admin]
});
export const pricePreview = handle(previewResolvedPrice, 'Price preview loaded', {
  mapArgs: (req) => [req.query]
});

export const bookings = handle(listAdminBookings, 'Bookings loaded', {
  mapArgs: (req) => [req.query]
});
export const bookingDetail = handle(getAdminBookingDetail, 'Booking loaded', {
  mapArgs: (req) => [req.params.bookingNo]
});
export const bookingUpdate = handle(updateAdminBooking, 'Booking updated', {
  mapArgs: (req) => [req.params.bookingNo, req.body, req.admin]
});
export const bookingReschedule = handle(changeBookingSchedule, 'Booking rescheduled', {
  mapArgs: (req) => [req.params.bookingNo, req.body, req.admin]
});
export const bookingCancel = handle(cancelBooking, 'Booking cancelled', {
  mapArgs: (req) => [req.params.bookingNo, req.body, req.admin]
});
export const bookingMarkPaid = handle(markBookingPaid, 'Booking payment confirmed', {
  mapArgs: (req) => [req.params.bookingNo, req.body, req.admin]
});
export const bookingResend = handle(resendBookingTicketsAdmin, 'Tickets resent', {
  mapArgs: (req) => [req.params.bookingNo, req.admin]
});
export const bookingRefund = handle(refundBooking, 'Booking refunded', {
  mapArgs: (req) => [req.params.bookingNo, req.body, req.admin]
});

export const posSale = handle(createWalkInSale, 'Walk-in sale created', {
  status: 201
});

export const gateSearch = handle(searchTickets, 'Tickets loaded', {
  mapArgs: (req) => [req.query]
});
export const gateScan = handle(scanTicket, 'Gate scan completed');

export const payments = handle(listAdminPayments, 'Payments loaded', {
  mapArgs: (req) => [req.query]
});
export const paymentDetail = handle(getAdminPaymentDetail, 'Payment loaded', {
  mapArgs: (req) => [req.params.paymentRef]
});
export const paymentConfirm = handle(confirmPaymentManually, 'Payment confirmed', {
  mapArgs: (req) => [req.params.paymentRef, req.body, req.admin]
});
export const paymentRefund = handle(refundPaymentManually, 'Payment refunded', {
  mapArgs: (req) => [req.params.paymentRef, req.body, req.admin]
});

export const reportSales = handle(getSalesReport, 'Sales report loaded', {
  mapArgs: (req) => [req.query]
});
export const reportPassengers = handle(getPassengerReport, 'Passenger report loaded', {
  mapArgs: (req) => [req.query]
});

export const users = handle(listAdminUsers, 'Admin users loaded', {
  mapArgs: (req) => [req.query]
});
export const userCreate = handle(createAdminUser, 'Admin user created', {
  status: 201
});
export const userUpdate = handle(updateAdminUser, 'Admin user updated', {
  mapArgs: (req) => [req.params.id, req.body, req.admin]
});
export const userResetPassword = handle(resetManagedAdminPassword, 'Admin user password reset', {
  mapArgs: (req) => [req.params.id, req.body, req.admin]
});

export const roles = handle(listRoles, 'Roles loaded', {
  mapArgs: () => []
});
export const roleCreate = handle(createRole, 'Role created', {
  status: 201
});
export const roleUpdate = handle(updateRole, 'Role updated', {
  mapArgs: (req) => [req.params.code, req.body, req.admin]
});

export const agents = handle(listAgents, 'Agents loaded', {
  mapArgs: (req) => [req.query]
});
export const agentCreate = handle(createAgent, 'Agent created', {
  status: 201
});
export const agentUpdate = handle(updateAgent, 'Agent updated', {
  mapArgs: (req) => [req.params.id, req.body, req.admin]
});
export const agentSales = handle(getAgentSalesSummary, 'Agent sales loaded', {
  mapArgs: (req) => [req.params.id, req.query]
});

export const notifications = handle(listNotificationsCenter, 'Notifications loaded', {
  mapArgs: (req) => [req.query]
});
export const notificationCreate = handle(createNotificationEntry, 'Notification created', {
  status: 201
});
export const notificationRead = handle(markNotificationRead, 'Notification marked as read', {
  mapArgs: (req) => [req.params.id, req.admin]
});

export const settings = handle(listSystemSettings, 'Settings loaded', {
  mapArgs: (req) => [req.query]
});
export const settingsUpdate = handle(updateSystemSettings, 'Settings updated');
export const settingsExport = handle(exportSystemSettings, 'Settings exported', {
  mapArgs: () => []
});
export const settingsImport = handle(importSystemSettings, 'Settings imported');
