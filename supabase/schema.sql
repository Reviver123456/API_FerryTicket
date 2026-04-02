create extension if not exists pgcrypto;

drop view if exists public.schedule_overview;

drop table if exists public.system_settings cascade;
drop table if exists public.notifications cascade;
drop table if exists public.tickets cascade;
drop table if exists public.payments cascade;
drop table if exists public.booking_passengers cascade;
drop table if exists public.booking_items cascade;
drop table if exists public.bookings cascade;
drop table if exists public.prices cascade;
drop table if exists public.holiday_calendar cascade;
drop table if exists public.schedules cascade;
drop table if exists public.vessels cascade;
drop table if exists public.ticket_types cascade;
drop table if exists public.agents cascade;
drop table if exists public.password_reset_tokens cascade;
drop table if exists public.users cascade;
drop table if exists public.roles cascade;

drop function if exists public.expire_stale_bookings();
drop function if exists public.release_schedule_seats(uuid, integer);
drop function if exists public.reserve_schedule_seats(uuid, integer);
drop function if exists public.set_updated_at();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_status_valid check (status in ('active', 'inactive'))
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  role_id uuid references public.roles(id) on delete set null,
  user_type text not null default 'customer',
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  password_hash text not null,
  profile_image_url text,
  profile_image_path text,
  auth_user_id uuid,
  permissions_override jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_user_type_valid check (user_type in ('customer', 'admin', 'agent', 'staff')),
  constraint users_status_valid check (status in ('active', 'inactive', 'suspended'))
);

create unique index users_auth_user_id_idx on public.users(auth_user_id) where auth_user_id is not null;

create table public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  requested_ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.agents (
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
  updated_at timestamptz not null default now(),
  constraint agents_credit_limit_non_negative check (credit_limit >= 0),
  constraint agents_status_valid check (status in ('active', 'inactive'))
);

create table public.vessels (
  id uuid primary key default gen_random_uuid(),
  boat_name text not null,
  registration_no text,
  capacity integer not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vessels_capacity_positive check (capacity > 0),
  constraint vessels_status_valid check (status in ('active', 'inactive'))
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_th text not null,
  name_en text,
  description text,
  benefit_text text,
  display_order integer not null default 0,
  requires_document boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_types_status_valid check (status in ('active', 'inactive'))
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_code text not null unique,
  trip_date date not null,
  departure_time time not null,
  arrival_time time,
  vessel_id uuid references public.vessels(id) on delete set null,
  capacity integer not null,
  available_seats integer not null,
  status text not null default 'open',
  route_name text,
  origin_port text,
  destination_port text,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_capacity_positive check (capacity > 0),
  constraint schedules_available_seats_valid check (available_seats >= 0 and available_seats <= capacity),
  constraint schedules_status_valid check (status in ('open', 'closed', 'cancelled'))
);

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  price_type text not null,
  day_type text not null default 'all',
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  effective_from date not null,
  effective_to date,
  amount numeric(12,2) not null,
  currency text not null default 'THB',
  status text not null default 'active',
  created_by_user_id uuid references public.users(id) on delete set null,
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prices_price_type_valid check (price_type in ('standard', 'agent')),
  constraint prices_day_type_valid check (day_type in ('all', 'weekday', 'weekend', 'holiday')),
  constraint prices_status_valid check (status in ('active', 'inactive')),
  constraint prices_amount_non_negative check (amount >= 0),
  constraint prices_agent_required check (
    (price_type = 'standard' and agent_id is null)
    or
    (price_type = 'agent' and agent_id is not null)
  )
);

create table public.holiday_calendar (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_no text not null unique,
  user_id uuid references public.users(id) on delete set null,
  guest_email text,
  guest_phone text,
  contact_name text,
  contact_email text,
  contact_phone text,
  schedule_id uuid not null references public.schedules(id) on delete restrict,
  ticket_type_summary jsonb not null default '[]'::jsonb,
  passenger_count integer not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid',
  booking_status text not null default 'draft',
  hold_expired_at timestamptz,
  source_channel text not null default 'web',
  agent_id uuid references public.agents(id) on delete set null,
  created_by_user_id uuid references public.users(id) on delete set null,
  updated_by_user_id uuid references public.users(id) on delete set null,
  notes text,
  cancelled_at timestamptz,
  cancel_reason text,
  rescheduled_from_schedule_id uuid references public.schedules(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_passenger_count_non_negative check (passenger_count >= 0),
  constraint bookings_total_amount_non_negative check (total_amount >= 0),
  constraint bookings_payment_status_valid check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  constraint bookings_booking_status_valid check (booking_status in ('draft', 'pending_payment', 'confirmed', 'cancelled', 'expired', 'refunded'))
);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  total_price numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_items_quantity_positive check (quantity > 0),
  constraint booking_items_prices_non_negative check (unit_price >= 0 and total_price >= 0)
);

create table public.booking_passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  full_name text not null,
  passenger_type text not null default 'adult',
  seat_no text,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  payment_ref text not null unique,
  payment_method text not null,
  gateway_name text,
  amount numeric(12,2) not null,
  currency text not null default 'THB',
  paid_at timestamptz,
  transaction_id text,
  reference_no text,
  proof_url text,
  status text not null default 'pending',
  confirmed_by_user_id uuid references public.users(id) on delete set null,
  refund_reason text,
  refunded_at timestamptz,
  refunded_by_user_id uuid references public.users(id) on delete set null,
  raw_response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_non_negative check (amount >= 0),
  constraint payments_status_valid check (status in ('pending', 'success', 'failed', 'expired', 'refunded'))
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  passenger_id uuid references public.booking_passengers(id) on delete set null,
  schedule_id uuid not null references public.schedules(id) on delete restrict,
  ticket_type_id uuid references public.ticket_types(id) on delete set null,
  qr_token text not null unique,
  qr_image text,
  status text not null default 'unused',
  issued_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_qr_token_format check (qr_token ~ '^[0-9]{10}$'),
  constraint tickets_status_valid check (status in ('unused', 'used', 'cancelled', 'refunded'))
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  created_by_user_id uuid references public.users(id) on delete set null,
  channel text not null default 'internal',
  type text not null default 'info',
  priority text not null default 'normal',
  subject text,
  message text not null,
  status text not null default 'sent',
  is_read boolean not null default false,
  read_at timestamptz,
  target_path text,
  meta_json jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_channel_valid check (channel in ('internal', 'email', 'sms', 'line')),
  constraint notifications_type_valid check (type in ('info', 'success', 'warning', 'error')),
  constraint notifications_priority_valid check (priority in ('low', 'normal', 'high')),
  constraint notifications_status_valid check (status in ('pending', 'sent', 'failed'))
);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  key text not null,
  value_json jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category, key)
);

create index idx_users_role_id on public.users(role_id);
create index idx_users_user_type on public.users(user_type);
create index idx_users_status on public.users(status);
create index idx_agents_status on public.agents(status);
create index idx_ticket_types_status on public.ticket_types(status);
create index idx_schedules_trip_date on public.schedules(trip_date);
create index idx_schedules_status on public.schedules(status);
create index idx_prices_lookup on public.prices(ticket_type_id, price_type, day_type, status, effective_from, effective_to);
create index idx_holiday_calendar_date on public.holiday_calendar(holiday_date, is_active);
create index idx_bookings_booking_no on public.bookings(booking_no);
create index idx_bookings_user_id on public.bookings(user_id);
create index idx_bookings_schedule_id on public.bookings(schedule_id);
create index idx_bookings_status on public.bookings(booking_status);
create index idx_bookings_hold_expired_at on public.bookings(hold_expired_at);
create index idx_payments_payment_ref on public.payments(payment_ref);
create index idx_payments_booking_id on public.payments(booking_id);
create index idx_tickets_ticket_no on public.tickets(ticket_no);
create index idx_tickets_booking_id on public.tickets(booking_id);
create index idx_notifications_user_id on public.notifications(user_id);
create index idx_notifications_is_read on public.notifications(is_read);
create index idx_system_settings_category on public.system_settings(category);

create trigger set_roles_updated_at before update on public.roles
for each row execute function public.set_updated_at();

create trigger set_users_updated_at before update on public.users
for each row execute function public.set_updated_at();

create trigger set_agents_updated_at before update on public.agents
for each row execute function public.set_updated_at();

create trigger set_vessels_updated_at before update on public.vessels
for each row execute function public.set_updated_at();

create trigger set_ticket_types_updated_at before update on public.ticket_types
for each row execute function public.set_updated_at();

create trigger set_schedules_updated_at before update on public.schedules
for each row execute function public.set_updated_at();

create trigger set_prices_updated_at before update on public.prices
for each row execute function public.set_updated_at();

create trigger set_holiday_calendar_updated_at before update on public.holiday_calendar
for each row execute function public.set_updated_at();

create trigger set_bookings_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

create trigger set_booking_items_updated_at before update on public.booking_items
for each row execute function public.set_updated_at();

create trigger set_booking_passengers_updated_at before update on public.booking_passengers
for each row execute function public.set_updated_at();

create trigger set_payments_updated_at before update on public.payments
for each row execute function public.set_updated_at();

create trigger set_tickets_updated_at before update on public.tickets
for each row execute function public.set_updated_at();

create trigger set_notifications_updated_at before update on public.notifications
for each row execute function public.set_updated_at();

create trigger set_system_settings_updated_at before update on public.system_settings
for each row execute function public.set_updated_at();

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
    select b.id, b.booking_no, b.schedule_id, b.passenger_count
    from public.bookings b
    where b.hold_expired_at < now()
      and b.booking_status in ('draft', 'pending_payment')
    for update
  ), updated as (
    update public.bookings b
    set booking_status = 'expired',
        payment_status = case when b.payment_status = 'pending' then 'failed' else b.payment_status end,
        updated_at = now()
    from stale s
    where b.id = s.id
    returning s.id, s.booking_no, s.schedule_id, s.passenger_count
  ), released as (
    update public.schedules sch
    set available_seats = least(sch.capacity, sch.available_seats + upd.passenger_count),
        updated_at = now()
    from updated upd
    where sch.id = upd.schedule_id
    returning upd.id, upd.booking_no
  )
  select released.id, released.booking_no
  from released;
end;
$$;

create or replace view public.schedule_overview as
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
  v.id as vessel_id,
  v.boat_name,
  v.registration_no
from public.schedules s
left join public.vessels v on v.id = s.vessel_id;
