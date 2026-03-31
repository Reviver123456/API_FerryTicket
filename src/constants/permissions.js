export const ALL_PERMISSIONS = [
  'dashboard.view',
  'reports.view',
  'roles.view',
  'roles.manage',
  'users.view',
  'users.manage',
  'ticket_types.manage',
  'schedules.manage',
  'prices.view',
  'prices.manage',
  'bookings.view',
  'bookings.manage',
  'bookings.cancel',
  'bookings.reschedule',
  'payments.view',
  'payments.manage',
  'payments.refund',
  'tickets.view',
  'tickets.resend',
  'notifications.view',
  'notifications.manage',
  'agents.view',
  'agents.manage',
  'settings.view',
  'settings.manage',
  'pos.sell'
];

export const uniquePermissions = (permissions = []) => [
  ...new Set((permissions || []).filter(Boolean))
];
