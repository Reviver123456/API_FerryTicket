begin;

insert into public.roles(id, code, name, description, permissions, status, sort_order)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'customer',
    'Customer',
    'Standard customer access',
    '[]'::jsonb,
    'active',
    1
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'admin',
    'Admin',
    'Operational administrator',
    '["dashboard.view","reports.view","roles.view","roles.manage","users.view","users.manage","ticket_types.manage","schedules.manage","prices.view","prices.manage","bookings.view","bookings.manage","bookings.cancel","bookings.reschedule","payments.view","payments.manage","payments.refund","tickets.view","tickets.resend","notifications.view","notifications.manage","agents.view","agents.manage","settings.view","settings.manage","pos.sell"]'::jsonb,
    'active',
    2
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'staff',
    'Staff',
    'Counter and support staff',
    '["dashboard.view","reports.view","bookings.view","bookings.manage","payments.view","tickets.view","tickets.resend","notifications.view","notifications.manage","pos.sell"]'::jsonb,
    'active',
    3
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'agent',
    'Agent',
    'Partner sales role',
    '["prices.view","bookings.view","bookings.manage","payments.view","tickets.view","notifications.view"]'::jsonb,
    'active',
    4
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.users(
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
values
  (
    '10000000-0000-0000-0000-000000000001',
    'USRDEMO0001',
    '20000000-0000-0000-0000-000000000001',
    'customer',
    'Demo',
    'Customer One',
    'demo.customer1@example.com',
    '0811111111',
    '12345678',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'USRDEMO0002',
    '20000000-0000-0000-0000-000000000001',
    'customer',
    'Demo',
    'Customer Two',
    'demo.customer2@example.com',
    '0822222222',
    '12345678',
    'active'
  ),
  (
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
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'USRSTAFF001',
    '20000000-0000-0000-0000-000000000003',
    'staff',
    'Ticket',
    'Staff',
    'staff@example.com',
    '0890000002',
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

insert into public.agents(
  id,
  agent_code,
  name,
  company_name,
  contact_name,
  email,
  phone,
  payment_terms_days,
  credit_limit,
  status,
  contract_notes,
  address
)
values
  (
    '12000000-0000-0000-0000-000000000001',
    'AGTDEMO001',
    'Island Travel Agent',
    'Island Travel Co., Ltd.',
    'Agent Manager',
    'agent.demo@example.com',
    '0855555555',
    15,
    50000.00,
    'active',
    'Standard reseller terms',
    'Phuket'
  )
on conflict (agent_code) do update
set
  name = excluded.name,
  company_name = excluded.company_name,
  contact_name = excluded.contact_name,
  email = excluded.email,
  phone = excluded.phone,
  payment_terms_days = excluded.payment_terms_days,
  credit_limit = excluded.credit_limit,
  status = excluded.status,
  contract_notes = excluded.contract_notes,
  address = excluded.address,
  updated_at = now();

insert into public.vessels(id, boat_name, registration_no, capacity, status)
values
  ('30000000-0000-0000-0000-000000000001', 'Andaman Pearl', 'TH-001', 120, 'active'),
  ('30000000-0000-0000-0000-000000000002', 'Sea Breeze', 'TH-002', 80, 'active')
on conflict (id) do update
set
  boat_name = excluded.boat_name,
  registration_no = excluded.registration_no,
  capacity = excluded.capacity,
  status = excluded.status,
  updated_at = now();

insert into public.ticket_types(id, code, name_th, name_en, description, benefit_text, display_order, status)
values
  (
    '40000000-0000-0000-0000-000000000001',
    'ADULT',
    'ผู้ใหญ่',
    'Adult',
    'ตั๋วผู้ใหญ่',
    'ขึ้นเรือมาตรฐาน',
    1,
    'active'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    'CHILD',
    'เด็ก',
    'Child',
    'ตั๋วเด็ก',
    'สำหรับเด็กอายุไม่เกิน 12 ปี',
    2,
    'active'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    'VIP',
    'วีไอพี',
    'VIP',
    'ตั๋ว VIP',
    'ที่นั่งพิเศษพร้อมเครื่องดื่ม',
    3,
    'active'
  )
on conflict (code) do update
set
  name_th = excluded.name_th,
  name_en = excluded.name_en,
  description = excluded.description,
  benefit_text = excluded.benefit_text,
  display_order = excluded.display_order,
  status = excluded.status,
  updated_at = now();

with schedule_days as (
  select generate_series(date '2026-03-31', date '2026-04-10', interval '1 day')::date as trip_date
),
schedule_times as (
  select time '09:00' as departure_time, time '10:30' as arrival_time, '30000000-0000-0000-0000-000000000001'::uuid as vessel_id, 120 as capacity
  union all
  select time '13:00', time '14:30', '30000000-0000-0000-0000-000000000002'::uuid, 80
  union all
  select time '17:00', time '18:30', '30000000-0000-0000-0000-000000000001'::uuid, 120
)
insert into public.schedules(
  schedule_code,
  trip_date,
  departure_time,
  arrival_time,
  vessel_id,
  capacity,
  available_seats,
  status,
  route_name,
  origin_port,
  destination_port
)
select
  'TEST-' || to_char(d.trip_date, 'YYYYMMDD') || '-' || to_char(t.departure_time, 'HH24MI'),
  d.trip_date,
  t.departure_time,
  t.arrival_time,
  t.vessel_id,
  t.capacity,
  t.capacity,
  'open',
  'Main Pier - Island Pier',
  'Main Pier',
  'Island Pier'
from schedule_days d
cross join schedule_times t
on conflict (schedule_code) do update
set
  trip_date = excluded.trip_date,
  departure_time = excluded.departure_time,
  arrival_time = excluded.arrival_time,
  vessel_id = excluded.vessel_id,
  capacity = excluded.capacity,
  available_seats = excluded.available_seats,
  status = excluded.status,
  route_name = excluded.route_name,
  origin_port = excluded.origin_port,
  destination_port = excluded.destination_port,
  updated_at = now();

insert into public.holiday_calendar(
  id,
  holiday_date,
  name,
  description,
  is_active
)
values
  (
    '61000000-0000-0000-0000-000000000001',
    date '2026-04-06',
    'Chakri Memorial Day',
    'Sample seeded public holiday',
    true
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    date '2026-04-13',
    'Songkran Festival Day 1',
    'Sample seeded public holiday',
    true
  ),
  (
    '61000000-0000-0000-0000-000000000003',
    date '2026-04-14',
    'Songkran Festival Day 2',
    'Sample seeded public holiday',
    true
  ),
  (
    '61000000-0000-0000-0000-000000000004',
    date '2026-04-15',
    'Songkran Festival Day 3',
    'Sample seeded public holiday',
    true
  )
on conflict (holiday_date) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.prices(
  id,
  price_type,
  day_type,
  ticket_type_id,
  agent_id,
  effective_from,
  effective_to,
  amount,
  currency,
  status,
  created_by_user_id,
  updated_by_user_id
)
values
  (
    '60000000-0000-0000-0000-000000000001',
    'standard',
    'weekday',
    '40000000-0000-0000-0000-000000000001',
    null,
    date '2026-03-01',
    date '2026-12-31',
    120.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    'standard',
    'weekend',
    '40000000-0000-0000-0000-000000000001',
    null,
    date '2026-03-01',
    date '2026-12-31',
    150.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    'standard',
    'holiday',
    '40000000-0000-0000-0000-000000000001',
    null,
    date '2026-03-01',
    date '2026-12-31',
    180.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    'standard',
    'weekday',
    '40000000-0000-0000-0000-000000000002',
    null,
    date '2026-03-01',
    date '2026-12-31',
    80.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000005',
    'standard',
    'weekend',
    '40000000-0000-0000-0000-000000000002',
    null,
    date '2026-03-01',
    date '2026-12-31',
    100.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000006',
    'standard',
    'holiday',
    '40000000-0000-0000-0000-000000000002',
    null,
    date '2026-03-01',
    date '2026-12-31',
    120.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000007',
    'standard',
    'weekday',
    '40000000-0000-0000-0000-000000000003',
    null,
    date '2026-03-01',
    date '2026-12-31',
    250.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000008',
    'standard',
    'weekend',
    '40000000-0000-0000-0000-000000000003',
    null,
    date '2026-03-01',
    date '2026-12-31',
    300.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000009',
    'standard',
    'holiday',
    '40000000-0000-0000-0000-000000000003',
    null,
    date '2026-03-01',
    date '2026-12-31',
    350.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000010',
    'agent',
    'weekday',
    '40000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    date '2026-03-01',
    date '2026-12-31',
    100.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000011',
    'agent',
    'weekend',
    '40000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    date '2026-03-01',
    date '2026-12-31',
    120.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '60000000-0000-0000-0000-000000000012',
    'agent',
    'holiday',
    '40000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    date '2026-03-01',
    date '2026-12-31',
    140.00,
    'THB',
    'active',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  )
on conflict (id) do update
set
  price_type = excluded.price_type,
  day_type = excluded.day_type,
  ticket_type_id = excluded.ticket_type_id,
  agent_id = excluded.agent_id,
  effective_from = excluded.effective_from,
  effective_to = excluded.effective_to,
  amount = excluded.amount,
  currency = excluded.currency,
  status = excluded.status,
  updated_by_user_id = excluded.updated_by_user_id,
  updated_at = now();

insert into public.system_settings(category, key, value_json, description, is_public)
values
  ('general', 'system_name', '{"value":"Ferry Ticketing API"}'::jsonb, 'System display name', true),
  ('payment', 'payment_expiry_minutes', '{"value":15}'::jsonb, 'Booking hold/payment due time in minutes', false),
  ('payment', 'supported_channels', '{"channels":["cash","transfer","qr_promptpay","card"]}'::jsonb, 'Supported payment channels', false),
  ('notifications', 'templates', '{"booking_created":"Booking created","payment_success":"Payment successful","payment_failed":"Payment failed"}'::jsonb, 'Notification templates', false)
on conflict (category, key) do update
set
  value_json = excluded.value_json,
  description = excluded.description,
  is_public = excluded.is_public,
  updated_at = now();

commit;
