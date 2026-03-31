create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text not null unique,
  password text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists auth_user_id uuid,
  add column if not exists profile_image_url text,
  add column if not exists profile_image_path text;

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  requested_ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists password_reset_tokens_token_hash_idx
  on public.password_reset_tokens(token_hash);

create index if not exists password_reset_tokens_user_id_idx
  on public.password_reset_tokens(user_id);

create table if not exists public.vessels (
  id uuid primary key default gen_random_uuid(),
  boat_name text not null,
  registration_no text,
  capacity integer not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  name_th text not null,
  code text not null unique,
  price numeric(12,2) not null,
  description text,
  benefit_text text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_code text unique,
  trip_date date not null,
  departure_time time not null,
  arrival_time time,
  vessel_id uuid references public.vessels(id) on delete set null,
  capacity integer not null,
  available_seats integer not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_no text not null unique,
  user_id uuid references public.users(id) on delete set null,
  schedule_id uuid not null references public.schedules(id) on delete restrict,
  contact_name text,
  contact_phone text,
  contact_email text,
  total_passengers integer not null default 0,
  total_amount numeric(12,2) not null default 0,
  booking_status text not null default 'draft',
  expired_at timestamptz,
  source_channel text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  total_price numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  full_name text not null,
  passenger_type text not null default 'adult',
  seat_no text,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  payment_ref text not null unique,
  payment_method text not null,
  gateway_name text,
  amount numeric(12,2) not null,
  paid_at timestamptz,
  transaction_id text,
  status text not null default 'pending',
  raw_response_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  passenger_id uuid references public.passengers(id) on delete set null,
  schedule_id uuid not null references public.schedules(id) on delete restrict,
  ticket_type_id uuid references public.ticket_types(id) on delete set null,
  qr_token text not null unique,
  qr_image text,
  status text not null default 'active',
  issued_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gate_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete set null,
  scan_time timestamptz not null,
  gate_code text,
  device_code text,
  result text not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  channel text not null,
  subject text,
  message text,
  status text not null default 'pending',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null,
  role text not null default 'staff',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_vessels_updated_at on public.vessels;
create trigger set_vessels_updated_at before update on public.vessels
for each row execute function public.set_updated_at();

drop trigger if exists set_ticket_types_updated_at on public.ticket_types;
create trigger set_ticket_types_updated_at before update on public.ticket_types
for each row execute function public.set_updated_at();

drop trigger if exists set_schedules_updated_at on public.schedules;
create trigger set_schedules_updated_at before update on public.schedules
for each row execute function public.set_updated_at();

drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists set_booking_items_updated_at on public.booking_items;
create trigger set_booking_items_updated_at before update on public.booking_items
for each row execute function public.set_updated_at();

drop trigger if exists set_passengers_updated_at on public.passengers;
create trigger set_passengers_updated_at before update on public.passengers
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_tickets_updated_at on public.tickets;
create trigger set_tickets_updated_at before update on public.tickets
for each row execute function public.set_updated_at();

drop trigger if exists set_admin_users_updated_at on public.admin_users;
create trigger set_admin_users_updated_at before update on public.admin_users
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ticket_types_price_non_negative'
  ) then
    alter table public.ticket_types
      add constraint ticket_types_price_non_negative check (price >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'schedules_capacity_positive'
  ) then
    alter table public.schedules
      add constraint schedules_capacity_positive check (capacity > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'schedules_available_seats_valid'
  ) then
    alter table public.schedules
      add constraint schedules_available_seats_valid check (available_seats >= 0 and available_seats <= capacity);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'booking_items_quantity_positive'
  ) then
    alter table public.booking_items
      add constraint booking_items_quantity_positive check (quantity > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'booking_items_prices_non_negative'
  ) then
    alter table public.booking_items
      add constraint booking_items_prices_non_negative check (unit_price >= 0 and total_price >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payments_amount_non_negative'
  ) then
    alter table public.payments
      add constraint payments_amount_non_negative check (amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bookings_status_valid'
  ) then
    alter table public.bookings
      add constraint bookings_status_valid check (booking_status in ('draft', 'pending_payment', 'confirmed', 'expired', 'cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payments_status_valid'
  ) then
    alter table public.payments
      add constraint payments_status_valid check (status in ('pending', 'success', 'failed', 'expired', 'refunded'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tickets_status_valid'
  ) then
    alter table public.tickets
      add constraint tickets_status_valid check (status in ('active', 'used', 'cancelled', 'expired'));
  end if;
end $$;

create or replace function public.reserve_schedule_seats(p_schedule_id uuid, p_seat_count integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_seat_count <= 0 then
    raise exception 'Seat count must be positive';
  end if;

  update public.schedules
  set available_seats = available_seats - p_seat_count,
      updated_at = now()
  where id = p_schedule_id
    and status = 'open'
    and available_seats >= p_seat_count;

  if not found then
    raise exception 'Schedule is unavailable or has insufficient seats';
  end if;
end;
$$;

create or replace function public.release_schedule_seats(p_schedule_id uuid, p_seat_count integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_seat_count <= 0 then
    return;
  end if;

  update public.schedules
  set available_seats = least(capacity, available_seats + p_seat_count),
      updated_at = now()
  where id = p_schedule_id;
end;
$$;

create or replace function public.expire_stale_bookings()
returns table (id uuid, booking_no text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with stale as (
    select b.id, b.booking_no, b.schedule_id, b.total_passengers
    from public.bookings b
    where b.expired_at < now()
      and b.booking_status in ('draft', 'pending_payment')
    for update
  ), updated as (
    update public.bookings b
    set booking_status = 'expired',
        updated_at = now()
    from stale s
    where b.id = s.id
    returning s.id, s.booking_no, s.schedule_id, s.total_passengers
  ), released as (
    update public.schedules sch
    set available_seats = least(sch.capacity, sch.available_seats + upd.total_passengers),
        updated_at = now()
    from updated upd
    where sch.id = upd.schedule_id
    returning upd.id, upd.booking_no
  )
  select released.id, released.booking_no
  from released;
end;
$$;

create index if not exists idx_bookings_booking_no on public.bookings(booking_no);
create index if not exists idx_bookings_schedule_id on public.bookings(schedule_id);
create index if not exists idx_bookings_status on public.bookings(booking_status);
create index if not exists idx_bookings_expired_at on public.bookings(expired_at);
create index if not exists idx_payments_payment_ref on public.payments(payment_ref);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_tickets_ticket_no on public.tickets(ticket_no);
create index if not exists idx_tickets_qr_token on public.tickets(qr_token);
create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_schedules_trip_date on public.schedules(trip_date);
create index if not exists idx_gate_logs_ticket_id on public.gate_logs(ticket_id);

insert into public.ticket_types(name_th, code, price, description)
values
('ผู้ใหญ่', 'ADULT', 120.00, 'ตั๋วผู้ใหญ่'),
('เด็ก', 'CHILD', 80.00, 'ตั๋วเด็ก'),
('VIP', 'VIP', 250.00, 'ตั๋ว VIP')
on conflict (code) do nothing;

insert into public.vessels(boat_name, registration_no, capacity)
values
('Andaman Pearl', 'TH-001', 120),
('Sea Breeze', 'TH-002', 80)
on conflict do nothing;

insert into public.schedules(schedule_code, trip_date, departure_time, arrival_time, vessel_id, capacity, available_seats, status)
select
  'SCH100001',
  current_date + integer '1',
  '09:00',
  '10:30',
  id,
  capacity,
  capacity,
  'open'
from public.vessels
order by created_at asc, id asc
limit 1
on conflict (schedule_code) do nothing;

insert into public.schedules(schedule_code, trip_date, departure_time, arrival_time, vessel_id, capacity, available_seats, status)
select
  'SCH100002',
  current_date + integer '1',
  '14:00',
  '15:30',
  id,
  capacity,
  capacity,
  'open'
from public.vessels
order by created_at asc, id asc
offset 1
limit 1
on conflict (schedule_code) do nothing;

create table if not exists public.admin_roles (
  code text primary key,
  name text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  agent_code text not null unique,
  name text not null,
  company_name text,
  contact_name text,
  email text,
  phone text,
  payment_terms_days integer not null default 0,
  credit_limit numeric(12,2) not null default 0,
  status text not null default 'active',
  contract_notes text,
  address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  requested_ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_price_rules (
  id uuid primary key default gen_random_uuid(),
  route_name text,
  schedule_id uuid references public.schedules(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  price numeric(12,2) not null,
  season_name text,
  valid_from date not null,
  valid_to date,
  version_no integer not null default 1,
  priority integer not null default 0,
  status text not null default 'active',
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_price_rules (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  route_name text,
  schedule_id uuid references public.schedules(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  price numeric(12,2),
  discount_amount numeric(12,2) not null default 0,
  valid_from date not null,
  valid_to date,
  priority integer not null default 0,
  status text not null default 'active',
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null default 'admin',
  actor_admin_user_id uuid references public.admin_users(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  booking_id uuid references public.bookings(id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  key text not null,
  value_json jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category, key)
);

alter table public.ticket_types
  add column if not exists display_order integer not null default 0,
  add column if not exists requires_document boolean not null default false,
  add column if not exists special_condition text;

alter table public.schedules
  add column if not exists route_name text,
  add column if not exists origin_port text,
  add column if not exists destination_port text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

alter table public.bookings
  add column if not exists agent_id uuid references public.agents(id) on delete set null,
  add column if not exists payment_due_at timestamptz,
  add column if not exists notes text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists rescheduled_from_schedule_id uuid references public.schedules(id) on delete set null;

alter table public.payments
  add column if not exists reference_no text,
  add column if not exists proof_url text,
  add column if not exists refund_reason text,
  add column if not exists refunded_at timestamptz,
  add column if not exists confirmed_by_admin_id uuid references public.admin_users(id) on delete set null;

alter table public.tickets
  add column if not exists boarded_at timestamptz;

alter table public.gate_logs
  add column if not exists admin_user_id uuid references public.admin_users(id) on delete set null;

alter table public.notifications
  add column if not exists admin_user_id uuid references public.admin_users(id) on delete set null,
  add column if not exists type text not null default 'info',
  add column if not exists priority text not null default 'normal',
  add column if not exists is_read boolean not null default false,
  add column if not exists read_at timestamptz,
  add column if not exists target_path text,
  add column if not exists meta_json jsonb not null default '{}'::jsonb;

alter table public.admin_users
  add column if not exists username text,
  add column if not exists phone text,
  add column if not exists auth_user_id uuid,
  add column if not exists agent_id uuid references public.agents(id) on delete set null,
  add column if not exists permissions_override jsonb not null default '[]'::jsonb,
  add column if not exists two_factor_enabled boolean not null default false,
  add column if not exists two_factor_method text,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_login_ip inet;

drop trigger if exists set_admin_roles_updated_at on public.admin_roles;
create trigger set_admin_roles_updated_at before update on public.admin_roles
for each row execute function public.set_updated_at();

drop trigger if exists set_agents_updated_at on public.agents;
create trigger set_agents_updated_at before update on public.agents
for each row execute function public.set_updated_at();

drop trigger if exists set_ticket_price_rules_updated_at on public.ticket_price_rules;
create trigger set_ticket_price_rules_updated_at before update on public.ticket_price_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_agent_price_rules_updated_at on public.agent_price_rules;
create trigger set_agent_price_rules_updated_at before update on public.agent_price_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at before update on public.system_settings
for each row execute function public.set_updated_at();

create unique index if not exists admin_password_reset_tokens_token_hash_idx
  on public.admin_password_reset_tokens(token_hash);
create unique index if not exists users_auth_user_id_idx
  on public.users(auth_user_id)
  where auth_user_id is not null;
create unique index if not exists admin_users_username_idx
  on public.admin_users(username)
  where username is not null;
create unique index if not exists admin_users_auth_user_id_idx
  on public.admin_users(auth_user_id)
  where auth_user_id is not null;
create index if not exists idx_bookings_agent_id on public.bookings(agent_id);
create index if not exists idx_payments_booking_id on public.payments(booking_id);
create index if not exists idx_notifications_admin_user_id on public.notifications(admin_user_id);
create index if not exists idx_notifications_is_read on public.notifications(is_read);
create index if not exists idx_agents_status on public.agents(status);
create index if not exists idx_ticket_price_rules_lookup
  on public.ticket_price_rules(ticket_type_id, status, valid_from, valid_to);
create index if not exists idx_agent_price_rules_lookup
  on public.agent_price_rules(agent_id, ticket_type_id, status, valid_from, valid_to);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_booking_id on public.audit_logs(booking_id);
create index if not exists idx_system_settings_category on public.system_settings(category);
create index if not exists idx_schedules_route_name on public.schedules(route_name);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agents_credit_limit_non_negative'
  ) then
    alter table public.agents
      add constraint agents_credit_limit_non_negative check (credit_limit >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ticket_price_rules_price_non_negative'
  ) then
    alter table public.ticket_price_rules
      add constraint ticket_price_rules_price_non_negative check (price >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'agent_price_rules_values_non_negative'
  ) then
    alter table public.agent_price_rules
      add constraint agent_price_rules_values_non_negative check (
        coalesce(price, 0) >= 0 and discount_amount >= 0
      );
  end if;
end $$;

update public.schedules
set
  route_name = coalesce(route_name, 'Main Pier - Island Pier'),
  origin_port = coalesce(origin_port, 'Main Pier'),
  destination_port = coalesce(destination_port, 'Island Pier')
where route_name is null
   or origin_port is null
   or destination_port is null;

drop view if exists public.schedule_overview;

create view public.schedule_overview as
select
  s.id,
  s.schedule_code,
  s.trip_date,
  s.departure_time,
  s.arrival_time,
  s.capacity,
  s.available_seats,
  s.status,
  s.route_name,
  s.origin_port,
  s.destination_port,
  s.cancelled_at,
  s.cancel_reason,
  v.boat_name,
  v.registration_no
from public.schedules s
left join public.vessels v on v.id = s.vessel_id;

insert into public.admin_roles(code, name, description, permissions, status, sort_order)
values
  ('super_admin', 'Super Admin', 'Full system access', '["*"]'::jsonb, 'active', 1),
  ('admin', 'Admin', 'Operational administrator', '["dashboard.view","schedules.view","schedules.manage","ticket_types.view","ticket_types.manage","prices.view","prices.manage","bookings.view","bookings.manage","bookings.cancel","bookings.reschedule","tickets.resend","pos.sell","gate.scan","payments.view","payments.manage","payments.refund","reports.view","users.view","users.manage","roles.view","agents.view","agents.manage","notifications.view","notifications.manage","settings.view","settings.manage"]'::jsonb, 'active', 2),
  ('staff', 'Staff', 'General counter staff', '["dashboard.view","schedules.view","ticket_types.view","bookings.view","bookings.manage","pos.sell","gate.scan","notifications.view"]'::jsonb, 'active', 3),
  ('ticket_staff', 'Ticket Staff', 'Walk-in sales and booking operations', '["dashboard.view","schedules.view","ticket_types.view","bookings.view","bookings.manage","pos.sell","gate.scan","notifications.view"]'::jsonb, 'active', 4),
  ('scanner', 'Scanner', 'Boarding gate scanner', '["dashboard.view","schedules.view","gate.scan","bookings.view","notifications.view"]'::jsonb, 'active', 5),
  ('finance', 'Finance', 'Payment and refund management', '["dashboard.view","payments.view","payments.manage","payments.refund","reports.view","bookings.view","notifications.view"]'::jsonb, 'active', 6),
  ('agent', 'Agent', 'Partner booking access', '["dashboard.view","schedules.view","prices.view","bookings.view","bookings.manage","notifications.view"]'::jsonb, 'active', 7)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.system_settings(category, key, value_json, description, is_public)
values
  ('general', 'system_name', '{"value":"Ferry Ticketing Admin"}'::jsonb, 'System display name', true),
  ('general', 'company_profile', '{"company_name":"Ferry Ticketing Co., Ltd.","tax_id":"","phone":"","email":""}'::jsonb, 'Company profile', false),
  ('ticketing', 'ticket_number_format', '{"prefix":"TK","digits":10}'::jsonb, 'Ticket number format', false),
  ('payment', 'payment_expiry_minutes', '{"value":15}'::jsonb, 'Payment due time in minutes', false),
  ('payment', 'supported_channels', '{"channels":["cash","transfer","qr_promptpay","card"]}'::jsonb, 'Supported payment channels', false),
  ('tax', 'vat', '{"enabled":false,"rate":7}'::jsonb, 'VAT configuration', false),
  ('printing', 'ticket_template', '{"size":"80mm","show_qr":true}'::jsonb, 'Ticket print template', false),
  ('notifications', 'templates', '{"booking_created":"Booking created","payment_success":"Payment successful","payment_failed":"Payment failed"}'::jsonb, 'Notification templates', false)
on conflict (category, key) do update
set
  value_json = excluded.value_json,
  description = excluded.description,
  is_public = excluded.is_public,
  updated_at = now();
