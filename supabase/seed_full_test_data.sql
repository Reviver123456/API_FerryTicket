begin;

-- Test accounts
-- customer: demo.customer1@example.com / 12345678
-- customer: demo.customer2@example.com / 12345678
-- customer: demo.inactive@example.com / 12345678
-- admin: admin@example.com / admin123456
-- admin: staff@example.com / admin123456

insert into public.admin_roles(code, name, description, permissions, status, sort_order)
values
  ('admin', 'Admin', 'Operational administrator', '["dashboard.view","schedules.view","schedules.manage","ticket_types.view","ticket_types.manage","prices.view","prices.manage","bookings.view","bookings.manage","bookings.cancel","bookings.reschedule","tickets.resend","pos.sell","gate.scan","payments.view","payments.manage","payments.refund","reports.view","users.view","users.manage","roles.view","agents.view","agents.manage","notifications.view","notifications.manage","settings.view","settings.manage"]'::jsonb, 'active', 1),
  ('staff', 'Staff', 'Counter and scanner staff', '["dashboard.view","schedules.view","ticket_types.view","bookings.view","bookings.manage","pos.sell","gate.scan","notifications.view"]'::jsonb, 'active', 2),
  ('finance', 'Finance', 'Finance operations', '["dashboard.view","payments.view","payments.manage","payments.refund","reports.view","bookings.view","notifications.view"]'::jsonb, 'active', 3),
  ('agent', 'Agent', 'Partner access', '["dashboard.view","schedules.view","prices.view","bookings.view","bookings.manage","notifications.view"]'::jsonb, 'active', 4)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  status = excluded.status,
  sort_order = excluded.sort_order;

insert into public.users(id, full_name, phone, email, password, status)
values
  ('10000000-0000-0000-0000-000000000001', 'Demo Customer One', '0811111111', 'demo.customer1@example.com', '12345678', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'Demo Customer Two', '0822222222', 'demo.customer2@example.com', '12345678', 'active'),
  ('10000000-0000-0000-0000-000000000003', 'Demo Inactive User', '0833333333', 'demo.inactive@example.com', '12345678', 'inactive')
on conflict (email) do update
set
  full_name = excluded.full_name,
  phone = excluded.phone,
  password = excluded.password,
  status = excluded.status;

insert into public.agents(id, agent_code, name, company_name, contact_name, email, phone, payment_terms_days, credit_limit, status, contract_notes, address)
values
  ('12000000-0000-0000-0000-000000000001', 'AGTDEMO001', 'Island Travel Agent', 'Island Travel Co., Ltd.', 'Agent Manager', 'agent.demo@example.com', '0855555555', 15, 50000.00, 'active', 'Standard reseller terms', 'Phuket'),
  ('12000000-0000-0000-0000-000000000002', 'AGTDEMO002', 'Sea Partner', 'Sea Partner Co., Ltd.', 'Sales Lead', 'agent.partner@example.com', '0866666666', 30, 100000.00, 'active', 'Priority partner', 'Krabi')
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
  address = excluded.address;

insert into public.admin_users(id, name, username, phone, email, password, role, status, agent_id)
values
  ('11000000-0000-0000-0000-000000000001', 'System Admin', 'sysadmin', '0890000001', 'admin@example.com', 'admin123456', 'admin', 'active', null),
  ('11000000-0000-0000-0000-000000000002', 'Ticket Staff', 'ticketstaff', '0890000002', 'staff@example.com', 'admin123456', 'staff', 'active', null),
  ('11000000-0000-0000-0000-000000000003', 'Inactive Staff', 'inactive.staff', '0890000003', 'inactive.staff@example.com', 'admin123456', 'staff', 'inactive', null),
  ('11000000-0000-0000-0000-000000000004', 'Demo Agent Login', 'agentdemo', '0890000004', 'agent.login@example.com', 'admin123456', 'agent', 'active', '12000000-0000-0000-0000-000000000001')
on conflict (email) do update
set
  name = excluded.name,
  username = excluded.username,
  phone = excluded.phone,
  password = excluded.password,
  role = excluded.role,
  status = excluded.status,
  agent_id = excluded.agent_id;

insert into public.ticket_types(name_th, code, price, description, benefit_text, status)
values
  ('ผู้ใหญ่', 'ADULT', 120.00, 'ตั๋วผู้ใหญ่', 'ขึ้นเรือมาตรฐาน', 'active'),
  ('เด็ก', 'CHILD', 80.00, 'ตั๋วเด็ก', 'สำหรับเด็กอายุไม่เกิน 12 ปี', 'active'),
  ('VIP', 'VIP', 250.00, 'ตั๋ว VIP', 'ที่นั่งพิเศษพร้อมเครื่องดื่ม', 'active')
on conflict (code) do update
set
  name_th = excluded.name_th,
  price = excluded.price,
  description = excluded.description,
  benefit_text = excluded.benefit_text,
  status = excluded.status;

insert into public.vessels(id, boat_name, registration_no, capacity, status)
values
  ('30000000-0000-0000-0000-000000000001', 'Andaman Pearl', 'TH-001', 120, 'active'),
  ('30000000-0000-0000-0000-000000000002', 'Sea Breeze', 'TH-002', 80, 'active')
on conflict (id) do update
set
  boat_name = excluded.boat_name,
  registration_no = excluded.registration_no,
  capacity = excluded.capacity,
  status = excluded.status;

with schedule_days as (
  select generate_series(date '2026-03-29', date '2026-04-28', interval '1 day')::date as trip_date
),
schedule_times as (
  select time '09:00' as departure_time, time '10:30' as arrival_time, '30000000-0000-0000-0000-000000000001'::uuid as vessel_id, 120 as capacity
  union all
  select time '11:00', time '12:30', '30000000-0000-0000-0000-000000000002'::uuid, 80
  union all
  select time '13:00', time '14:30', '30000000-0000-0000-0000-000000000001'::uuid, 120
  union all
  select time '15:00', time '16:30', '30000000-0000-0000-0000-000000000002'::uuid, 80
  union all
  select time '17:00', time '18:30', '30000000-0000-0000-0000-000000000001'::uuid, 120
  union all
  select time '19:00', time '20:30', '30000000-0000-0000-0000-000000000002'::uuid, 80
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
  destination_port = excluded.destination_port;

insert into public.ticket_price_rules(route_name, schedule_id, ticket_type_id, price, season_name, valid_from, valid_to, version_no, priority, status)
values
  ('Main Pier - Island Pier', null, (select id from public.ticket_types where code = 'ADULT'), 120.00, 'Default', date '2026-03-01', date '2026-12-31', 1, 10, 'active'),
  ('Main Pier - Island Pier', null, (select id from public.ticket_types where code = 'CHILD'), 80.00, 'Default', date '2026-03-01', date '2026-12-31', 1, 10, 'active'),
  ('Main Pier - Island Pier', null, (select id from public.ticket_types where code = 'VIP'), 250.00, 'Default', date '2026-03-01', date '2026-12-31', 1, 10, 'active')
on conflict do nothing;

insert into public.agent_price_rules(agent_id, route_name, schedule_id, ticket_type_id, price, discount_amount, valid_from, valid_to, priority, status)
values
  ((select id from public.agents where agent_code = 'AGTDEMO001'), 'Main Pier - Island Pier', null, (select id from public.ticket_types where code = 'ADULT'), 100.00, 0, date '2026-03-01', date '2026-12-31', 10, 'active'),
  ((select id from public.agents where agent_code = 'AGTDEMO001'), 'Main Pier - Island Pier', null, (select id from public.ticket_types where code = 'CHILD'), 70.00, 0, date '2026-03-01', date '2026-12-31', 10, 'active'),
  ((select id from public.agents where agent_code = 'AGTDEMO002'), 'Main Pier - Island Pier', null, (select id from public.ticket_types where code = 'VIP'), null, 30.00, date '2026-03-01', date '2026-12-31', 10, 'active')
on conflict do nothing;

insert into public.bookings(
  id,
  booking_no,
  user_id,
  schedule_id,
  contact_name,
  contact_phone,
  contact_email,
  total_passengers,
  total_amount,
  booking_status,
  expired_at,
  source_channel,
  ip_address,
  user_agent
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    'BKTEST000001',
    (select id from public.users where email = 'demo.customer1@example.com'),
    (select id from public.schedules where schedule_code = 'TEST-20260329-0900'),
    null,
    null,
    null,
    2,
    240.00,
    'draft',
    now() + interval '20 minutes',
    'web',
    '127.0.0.1',
    'seed/sql-editor'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    'BKTEST000002',
    (select id from public.users where email = 'demo.customer1@example.com'),
    (select id from public.schedules where schedule_code = 'TEST-20260329-1100'),
    'Demo Customer One',
    '0811111111',
    'demo.customer1@example.com',
    3,
    320.00,
    'pending_payment',
    now() + interval '30 minutes',
    'web',
    '127.0.0.11',
    'seed/sql-editor'
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    'BKTEST000003',
    (select id from public.users where email = 'demo.customer2@example.com'),
    (select id from public.schedules where schedule_code = 'TEST-20260329-1300'),
    'Demo Customer Two',
    '0822222222',
    'demo.customer2@example.com',
    1,
    250.00,
    'confirmed',
    now() + interval '1 day',
    'mobile',
    '127.0.0.12',
    'seed/sql-editor'
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    'BKTEST000004',
    (select id from public.users where email = 'demo.customer2@example.com'),
    (select id from public.schedules where schedule_code = 'TEST-20260329-1500'),
    'Demo Customer Two',
    '0822222222',
    'demo.customer2@example.com',
    1,
    120.00,
    'confirmed',
    now() + interval '1 day',
    'counter',
    '127.0.0.13',
    'seed/sql-editor'
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    'BKTEST000005',
    null,
    (select id from public.schedules where schedule_code = 'TEST-20260329-1700'),
    'Walk-in Guest',
    '0844444444',
    'walkin@example.com',
    2,
    160.00,
    'expired',
    now() - interval '1 day',
    'walkin',
    '127.0.0.14',
    'seed/sql-editor'
  ),
  (
    '50000000-0000-0000-0000-000000000006',
    'BKTEST000006',
    (select id from public.users where email = 'demo.customer1@example.com'),
    (select id from public.schedules where schedule_code = 'TEST-20260329-1900'),
    'Demo Customer One',
    '0811111111',
    'demo.customer1@example.com',
    1,
    120.00,
    'cancelled',
    now() + interval '1 day',
    'web',
    '127.0.0.15',
    'seed/sql-editor'
  ),
  (
    '50000000-0000-0000-0000-000000000007',
    'BKTEST000007',
    (select id from public.users where email = 'demo.customer2@example.com'),
    (select id from public.schedules where schedule_code = 'TEST-20260330-0900'),
    'Demo Customer Two',
    '0822222222',
    'demo.customer2@example.com',
    2,
    500.00,
    'cancelled',
    now() + interval '1 day',
    'partner',
    '127.0.0.16',
    'seed/sql-editor'
  ),
  (
    '50000000-0000-0000-0000-000000000008',
    'BKTEST000008',
    (select id from public.users where email = 'demo.inactive@example.com'),
    (select id from public.schedules where schedule_code = 'TEST-20260330-1100'),
    'Demo Inactive User',
    '0833333333',
    'demo.inactive@example.com',
    1,
    80.00,
    'confirmed',
    now() + interval '1 day',
    'admin',
    '127.0.0.17',
    'seed/sql-editor'
  )
on conflict (booking_no) do update
set
  user_id = excluded.user_id,
  schedule_id = excluded.schedule_id,
  contact_name = excluded.contact_name,
  contact_phone = excluded.contact_phone,
  contact_email = excluded.contact_email,
  total_passengers = excluded.total_passengers,
  total_amount = excluded.total_amount,
  booking_status = excluded.booking_status,
  expired_at = excluded.expired_at,
  source_channel = excluded.source_channel,
  ip_address = excluded.ip_address,
  user_agent = excluded.user_agent;

insert into public.booking_items(
  id,
  booking_id,
  ticket_type_id,
  quantity,
  unit_price,
  total_price
)
values
  ('60000000-0000-0000-0000-000000000001', (select id from public.bookings where booking_no = 'BKTEST000001'), (select id from public.ticket_types where code = 'ADULT'), 2, 120.00, 240.00),
  ('60000000-0000-0000-0000-000000000002', (select id from public.bookings where booking_no = 'BKTEST000002'), (select id from public.ticket_types where code = 'ADULT'), 2, 120.00, 240.00),
  ('60000000-0000-0000-0000-000000000003', (select id from public.bookings where booking_no = 'BKTEST000002'), (select id from public.ticket_types where code = 'CHILD'), 1, 80.00, 80.00),
  ('60000000-0000-0000-0000-000000000004', (select id from public.bookings where booking_no = 'BKTEST000003'), (select id from public.ticket_types where code = 'VIP'), 1, 250.00, 250.00),
  ('60000000-0000-0000-0000-000000000005', (select id from public.bookings where booking_no = 'BKTEST000004'), (select id from public.ticket_types where code = 'ADULT'), 1, 120.00, 120.00),
  ('60000000-0000-0000-0000-000000000006', (select id from public.bookings where booking_no = 'BKTEST000005'), (select id from public.ticket_types where code = 'CHILD'), 2, 80.00, 160.00),
  ('60000000-0000-0000-0000-000000000007', (select id from public.bookings where booking_no = 'BKTEST000006'), (select id from public.ticket_types where code = 'ADULT'), 1, 120.00, 120.00),
  ('60000000-0000-0000-0000-000000000008', (select id from public.bookings where booking_no = 'BKTEST000007'), (select id from public.ticket_types where code = 'VIP'), 2, 250.00, 500.00),
  ('60000000-0000-0000-0000-000000000009', (select id from public.bookings where booking_no = 'BKTEST000008'), (select id from public.ticket_types where code = 'CHILD'), 1, 80.00, 80.00)
on conflict (id) do update
set
  booking_id = excluded.booking_id,
  ticket_type_id = excluded.ticket_type_id,
  quantity = excluded.quantity,
  unit_price = excluded.unit_price,
  total_price = excluded.total_price;

insert into public.passengers(
  id,
  booking_id,
  full_name,
  passenger_type,
  seat_no,
  remark
)
values
  ('70000000-0000-0000-0000-000000000001', (select id from public.bookings where booking_no = 'BKTEST000002'), 'Passenger Pending 1', 'adult', 'A01', null),
  ('70000000-0000-0000-0000-000000000002', (select id from public.bookings where booking_no = 'BKTEST000002'), 'Passenger Pending 2', 'adult', 'A02', null),
  ('70000000-0000-0000-0000-000000000003', (select id from public.bookings where booking_no = 'BKTEST000002'), 'Passenger Pending 3', 'child', 'A03', 'เด็ก 10 ปี'),
  ('70000000-0000-0000-0000-000000000004', (select id from public.bookings where booking_no = 'BKTEST000003'), 'VIP Passenger', 'adult', 'V01', 'VIP lounge'),
  ('70000000-0000-0000-0000-000000000005', (select id from public.bookings where booking_no = 'BKTEST000004'), 'Used Ticket Passenger', 'adult', 'B01', null),
  ('70000000-0000-0000-0000-000000000006', (select id from public.bookings where booking_no = 'BKTEST000005'), 'Expired Passenger 1', 'child', 'C01', null),
  ('70000000-0000-0000-0000-000000000007', (select id from public.bookings where booking_no = 'BKTEST000005'), 'Expired Passenger 2', 'child', 'C02', null),
  ('70000000-0000-0000-0000-000000000008', (select id from public.bookings where booking_no = 'BKTEST000006'), 'Cancelled Passenger', 'adult', 'D01', 'ยกเลิกหลังชำระไม่สำเร็จ'),
  ('70000000-0000-0000-0000-000000000009', (select id from public.bookings where booking_no = 'BKTEST000007'), 'Refund Passenger 1', 'adult', 'V02', null),
  ('70000000-0000-0000-0000-000000000010', (select id from public.bookings where booking_no = 'BKTEST000007'), 'Refund Passenger 2', 'adult', 'V03', null),
  ('70000000-0000-0000-0000-000000000011', (select id from public.bookings where booking_no = 'BKTEST000008'), 'Expired Ticket Passenger', 'child', 'E01', 'ตั๋วถูกตั้งสถานะหมดอายุเพื่อเทส gate')
on conflict (id) do update
set
  booking_id = excluded.booking_id,
  full_name = excluded.full_name,
  passenger_type = excluded.passenger_type,
  seat_no = excluded.seat_no,
  remark = excluded.remark;

insert into public.payments(
  id,
  booking_id,
  payment_ref,
  payment_method,
  gateway_name,
  amount,
  paid_at,
  transaction_id,
  status,
  raw_response_json
)
values
  (
    '80000000-0000-0000-0000-000000000002',
    (select id from public.bookings where booking_no = 'BKTEST000002'),
    'PAYTEST0002',
    'qr_promptpay',
    'mock_gateway',
    320.00,
    null,
    null,
    'pending',
    jsonb_build_object(
      'payment_url', 'https://example.test/pay/PAYTEST0002',
      'qr_value', 'PAYTEST0002',
      'qr_text', 'PAYTEST0002',
      'qr_code_url', 'https://example.test/qr/PAYTEST0002.png'
    )
  ),
  (
    '80000000-0000-0000-0000-000000000003',
    (select id from public.bookings where booking_no = 'BKTEST000003'),
    'PAYTEST0003',
    'qr_promptpay',
    'mock_gateway',
    250.00,
    now() - interval '2 hours',
    'TXN-PAYTEST0003',
    'success',
    jsonb_build_object(
      'payment_url', 'https://example.test/pay/PAYTEST0003',
      'qr_value', 'PAYTEST0003',
      'qr_text', 'PAYTEST0003',
      'qr_code_url', 'https://example.test/qr/PAYTEST0003.png'
    )
  ),
  (
    '80000000-0000-0000-0000-000000000004',
    (select id from public.bookings where booking_no = 'BKTEST000004'),
    'PAYTEST0004',
    'qr_promptpay',
    'mock_gateway',
    120.00,
    now() - interval '90 minutes',
    'TXN-PAYTEST0004',
    'success',
    jsonb_build_object(
      'payment_url', 'https://example.test/pay/PAYTEST0004',
      'qr_value', 'PAYTEST0004',
      'qr_text', 'PAYTEST0004',
      'qr_code_url', 'https://example.test/qr/PAYTEST0004.png'
    )
  ),
  (
    '80000000-0000-0000-0000-000000000005',
    (select id from public.bookings where booking_no = 'BKTEST000005'),
    'PAYTEST0005',
    'qr_promptpay',
    'mock_gateway',
    160.00,
    null,
    null,
    'expired',
    jsonb_build_object(
      'payment_url', 'https://example.test/pay/PAYTEST0005',
      'qr_value', 'PAYTEST0005',
      'qr_text', 'PAYTEST0005',
      'qr_code_url', 'https://example.test/qr/PAYTEST0005.png'
    )
  ),
  (
    '80000000-0000-0000-0000-000000000006',
    (select id from public.bookings where booking_no = 'BKTEST000006'),
    'PAYTEST0006',
    'qr_promptpay',
    'mock_gateway',
    120.00,
    null,
    'TXN-PAYTEST0006-FAILED',
    'failed',
    jsonb_build_object(
      'payment_url', 'https://example.test/pay/PAYTEST0006',
      'qr_value', 'PAYTEST0006',
      'qr_text', 'PAYTEST0006',
      'qr_code_url', 'https://example.test/qr/PAYTEST0006.png'
    )
  ),
  (
    '80000000-0000-0000-0000-000000000007',
    (select id from public.bookings where booking_no = 'BKTEST000007'),
    'PAYTEST0007',
    'qr_promptpay',
    'mock_gateway',
    500.00,
    now() - interval '1 day',
    'TXN-PAYTEST0007',
    'refunded',
    jsonb_build_object(
      'payment_url', 'https://example.test/pay/PAYTEST0007',
      'qr_value', 'PAYTEST0007',
      'qr_text', 'PAYTEST0007',
      'qr_code_url', 'https://example.test/qr/PAYTEST0007.png',
      'refund_reason', 'customer_request'
    )
  ),
  (
    '80000000-0000-0000-0000-000000000008',
    (select id from public.bookings where booking_no = 'BKTEST000008'),
    'PAYTEST0008',
    'qr_promptpay',
    'mock_gateway',
    80.00,
    now() - interval '30 minutes',
    'TXN-PAYTEST0008',
    'success',
    jsonb_build_object(
      'payment_url', 'https://example.test/pay/PAYTEST0008',
      'qr_value', 'PAYTEST0008',
      'qr_text', 'PAYTEST0008',
      'qr_code_url', 'https://example.test/qr/PAYTEST0008.png'
    )
  )
on conflict (payment_ref) do update
set
  booking_id = excluded.booking_id,
  payment_method = excluded.payment_method,
  gateway_name = excluded.gateway_name,
  amount = excluded.amount,
  paid_at = excluded.paid_at,
  transaction_id = excluded.transaction_id,
  status = excluded.status,
  raw_response_json = excluded.raw_response_json;

insert into public.tickets(
  id,
  ticket_no,
  booking_id,
  passenger_id,
  schedule_id,
  ticket_type_id,
  qr_token,
  qr_image,
  status,
  issued_at,
  used_at
)
values
  (
    '90000000-0000-0000-0000-000000000003',
    'TKTEST0003A',
    (select id from public.bookings where booking_no = 'BKTEST000003'),
    (select id from public.passengers where full_name = 'VIP Passenger'),
    (select id from public.schedules where schedule_code = 'TEST-20260329-1300'),
    (select id from public.ticket_types where code = 'VIP'),
    'SCTEST0000000003',
    'data:image/png;base64,VEVTVF9RUl8wMDAz',
    'active',
    now() - interval '110 minutes',
    null
  ),
  (
    '90000000-0000-0000-0000-000000000004',
    'TKTEST0004A',
    (select id from public.bookings where booking_no = 'BKTEST000004'),
    (select id from public.passengers where full_name = 'Used Ticket Passenger'),
    (select id from public.schedules where schedule_code = 'TEST-20260329-1500'),
    (select id from public.ticket_types where code = 'ADULT'),
    'SCTEST0000000004',
    'data:image/png;base64,VEVTVF9RUl8wMDA0',
    'used',
    now() - interval '95 minutes',
    now() - interval '20 minutes'
  ),
  (
    '90000000-0000-0000-0000-000000000007',
    'TKTEST0007A',
    (select id from public.bookings where booking_no = 'BKTEST000007'),
    (select id from public.passengers where full_name = 'Refund Passenger 1'),
    (select id from public.schedules where schedule_code = 'TEST-20260330-0900'),
    (select id from public.ticket_types where code = 'VIP'),
    'SCTEST0000000007',
    'data:image/png;base64,VEVTVF9RUl8wMDA3',
    'cancelled',
    now() - interval '1 day',
    null
  ),
  (
    '90000000-0000-0000-0000-000000000008',
    'TKTEST0007B',
    (select id from public.bookings where booking_no = 'BKTEST000007'),
    (select id from public.passengers where full_name = 'Refund Passenger 2'),
    (select id from public.schedules where schedule_code = 'TEST-20260330-0900'),
    (select id from public.ticket_types where code = 'VIP'),
    'SCTEST0000000008',
    'data:image/png;base64,VEVTVF9RUl8wMDA4',
    'cancelled',
    now() - interval '1 day',
    null
  ),
  (
    '90000000-0000-0000-0000-000000000009',
    'TKTEST0008A',
    (select id from public.bookings where booking_no = 'BKTEST000008'),
    (select id from public.passengers where full_name = 'Expired Ticket Passenger'),
    (select id from public.schedules where schedule_code = 'TEST-20260330-1100'),
    (select id from public.ticket_types where code = 'CHILD'),
    'SCTEST0000000009',
    'data:image/png;base64,VEVTVF9RUl8wMDA5',
    'expired',
    now() - interval '40 minutes',
    null
  )
on conflict (ticket_no) do update
set
  booking_id = excluded.booking_id,
  passenger_id = excluded.passenger_id,
  schedule_id = excluded.schedule_id,
  ticket_type_id = excluded.ticket_type_id,
  qr_token = excluded.qr_token,
  qr_image = excluded.qr_image,
  status = excluded.status,
  issued_at = excluded.issued_at,
  used_at = excluded.used_at;

insert into public.gate_logs(
  id,
  ticket_id,
  scan_time,
  gate_code,
  device_code,
  result,
  reason
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    (select id from public.tickets where ticket_no = 'TKTEST0004A'),
    now() - interval '20 minutes',
    'GATE-A',
    'SCANNER-01',
    'allow',
    'Valid ticket'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    (select id from public.tickets where ticket_no = 'TKTEST0007A'),
    now() - interval '10 minutes',
    'GATE-B',
    'SCANNER-02',
    'deny',
    'Ticket status is cancelled'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    (select id from public.tickets where ticket_no = 'TKTEST0008A'),
    now() - interval '5 minutes',
    'GATE-C',
    'SCANNER-03',
    'deny',
    'Ticket status is expired'
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    null,
    now() - interval '2 minutes',
    'GATE-A',
    'SCANNER-99',
    'deny',
    'Ticket not found'
  )
on conflict (id) do update
set
  ticket_id = excluded.ticket_id,
  scan_time = excluded.scan_time,
  gate_code = excluded.gate_code,
  device_code = excluded.device_code,
  result = excluded.result,
  reason = excluded.reason;

insert into public.notifications(
  id,
  booking_id,
  ticket_id,
  user_id,
  channel,
  subject,
  message,
  status,
  sent_at
)
values
  (
    'b0000000-0000-0000-0000-000000000001',
    (select id from public.bookings where booking_no = 'BKTEST000002'),
    null,
    (select id from public.users where email = 'demo.customer1@example.com'),
    'email',
    'Pending payment reminder',
    'กรุณาชำระเงินสำหรับ booking BKTEST000002 ภายในเวลาที่กำหนด',
    'pending',
    null
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    (select id from public.bookings where booking_no = 'BKTEST000003'),
    (select id from public.tickets where ticket_no = 'TKTEST0003A'),
    (select id from public.users where email = 'demo.customer2@example.com'),
    'email',
    'Your e-ticket is ready',
    'ระบบได้ออกตั๋วสำหรับ booking BKTEST000003 เรียบร้อยแล้ว',
    'sent',
    now() - interval '100 minutes'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    (select id from public.bookings where booking_no = 'BKTEST000004'),
    (select id from public.tickets where ticket_no = 'TKTEST0004A'),
    (select id from public.users where email = 'demo.customer2@example.com'),
    'line',
    'Gate scan completed',
    'ตั๋ว TKTEST0004A ถูกใช้งานที่ประตูขึ้นเรือแล้ว',
    'sent',
    now() - interval '15 minutes'
  ),
  (
    'b0000000-0000-0000-0000-000000000004',
    (select id from public.bookings where booking_no = 'BKTEST000007'),
    (select id from public.tickets where ticket_no = 'TKTEST0007A'),
    (select id from public.users where email = 'demo.customer2@example.com'),
    'sms',
    'Refund completed',
    'การคืนเงินของ booking BKTEST000007 สำเร็จแล้ว และตั๋วถูกยกเลิก',
    'sent',
    now() - interval '12 hours'
  ),
  (
    'b0000000-0000-0000-0000-000000000005',
    (select id from public.bookings where booking_no = 'BKTEST000008'),
    (select id from public.tickets where ticket_no = 'TKTEST0008A'),
    (select id from public.users where email = 'demo.inactive@example.com'),
    'email',
    'Ticket expired for testing',
    'ตั๋วของ booking BKTEST000008 ถูกตั้งเป็น expired เพื่อใช้ในการทดสอบ',
    'sent',
    now() - interval '25 minutes'
  )
on conflict (id) do update
set
  booking_id = excluded.booking_id,
  ticket_id = excluded.ticket_id,
  user_id = excluded.user_id,
  channel = excluded.channel,
  subject = excluded.subject,
  message = excluded.message,
  status = excluded.status,
  sent_at = excluded.sent_at;

update public.schedules
set available_seats = case schedule_code
  when 'TEST-20260329-0900' then 118
  when 'TEST-20260329-1100' then 77
  when 'TEST-20260329-1300' then 119
  when 'TEST-20260329-1500' then 79
  when 'TEST-20260329-1700' then 120
  when 'TEST-20260329-1900' then 80
  when 'TEST-20260330-0900' then 120
  when 'TEST-20260330-1100' then 79
  else available_seats
end
where schedule_code in (
  'TEST-20260329-0900',
  'TEST-20260329-1100',
  'TEST-20260329-1300',
  'TEST-20260329-1500',
  'TEST-20260329-1700',
  'TEST-20260329-1900',
  'TEST-20260330-0900',
  'TEST-20260330-1100'
);

commit;
