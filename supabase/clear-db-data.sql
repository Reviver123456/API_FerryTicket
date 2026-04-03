begin;

-- Clear application data only.
-- This keeps schema, constraints, indexes, triggers, functions, and views intact.
-- It does NOT delete records from Supabase auth schema (auth.users).

truncate table
  public.system_settings,
  public.notifications,
  public.tickets,
  public.payments,
  public.booking_passengers,
  public.booking_items,
  public.bookings,
  public.prices,
  public.holiday_calendar,
  public.schedules,
  public.vessels,
  public.ticket_types,
  public.agents,
  public.password_reset_tokens,
  public.users,
  public.roles
restart identity cascade;

commit;
