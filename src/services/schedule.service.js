import { supabase } from '../config/supabase.js';
import { throwIfError, assert } from './base.service.js';

export const listSchedules = async (query) => {
  const { trip_date, status = 'open' } = query;

  let builder = supabase
    .from('schedule_overview')
    .select('*')
    .order('trip_date', { ascending: true })
    .order('departure_time', { ascending: true });

  if (trip_date) builder = builder.eq('trip_date', trip_date);
  if (status) builder = builder.eq('status', status);

  const { data, error } = await builder;
  throwIfError(error);
  return data;
};

export const getScheduleById = async (id) => {
  const { data, error } = await supabase
    .from('schedule_overview')
    .select('*')
    .eq('id', id)
    .single();

  throwIfError(error, 'Schedule not found');
  return data;
};

export const ensureScheduleAvailable = async (id, passengerCount = 1) => {
  const schedule = await getScheduleById(id);
  assert(schedule.status === 'open', 'Schedule is not open for booking');
  assert(schedule.available_seats >= passengerCount, 'Not enough seats available', 409);
  return schedule;
};
