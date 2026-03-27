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
  v.boat_name,
  v.registration_no
from public.schedules s
left join public.vessels v on v.id = s.vessel_id;

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
