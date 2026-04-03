begin;

insert into public.roles (
  id,
  code,
  name,
  description,
  permissions,
  status,
  sort_order
)
values (
  '20000000-0000-0000-0000-000000000002',
  'admin',
  'Admin',
  'Operational administrator',
  '[
    "dashboard.view",
    "reports.view",
    "roles.view",
    "roles.manage",
    "users.view",
    "users.manage",
    "ticket_types.manage",
    "schedules.manage",
    "prices.view",
    "prices.manage",
    "bookings.view",
    "bookings.manage",
    "bookings.cancel",
    "bookings.reschedule",
    "payments.view",
    "payments.manage",
    "payments.refund",
    "tickets.view",
    "tickets.resend",
    "notifications.view",
    "notifications.manage",
    "agents.view",
    "agents.manage",
    "settings.view",
    "settings.manage",
    "pos.sell"
  ]'::jsonb,
  'active',
  2
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.users (
  id,
  code,
  role_id,
  user_type,
  first_name,
  last_name,
  email,
  phone,
  password_hash,
  status
)
values (
  '10000000-0000-0000-0000-000000000003',
  'USRADMIN001',
  '20000000-0000-0000-0000-000000000002',
  'admin',
  'System',
  'Admin',
  'admin@example.com',
  '0890000001',
  'admin123456',
  'active'
)
on conflict (email) do update
set
  code = excluded.code,
  role_id = excluded.role_id,
  user_type = excluded.user_type,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  phone = excluded.phone,
  password_hash = excluded.password_hash,
  status = excluded.status,
  updated_at = now();

commit;
