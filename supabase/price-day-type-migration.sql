begin;

create extension if not exists pgcrypto;

create table if not exists public.holiday_calendar (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prices
  add column if not exists day_type text;

update public.prices
set day_type = 'all'
where day_type is null or btrim(day_type) = '';

alter table public.prices
  alter column day_type set default 'all';

alter table public.prices
  alter column day_type set not null;

alter table public.prices
  drop constraint if exists prices_day_type_valid;

alter table public.prices
  add constraint prices_day_type_valid
  check (day_type in ('all', 'weekday', 'weekend', 'holiday'));

drop index if exists public.idx_prices_lookup;
create index if not exists idx_prices_lookup
  on public.prices(ticket_type_id, price_type, day_type, status, effective_from, effective_to);

create index if not exists idx_holiday_calendar_date
  on public.holiday_calendar(holiday_date, is_active);

drop trigger if exists set_holiday_calendar_updated_at on public.holiday_calendar;
create trigger set_holiday_calendar_updated_at
before update on public.holiday_calendar
for each row execute function public.set_updated_at();

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

commit;
