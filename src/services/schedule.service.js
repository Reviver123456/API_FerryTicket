import { supabase } from '../config/supabase.js';
import { generateScheduleCode } from '../utils/ids.js';
import { assert, throwIfError } from './base.service.js';
import {
  normalizeDateString,
  normalizeOptionalString,
  normalizePositiveInteger,
  normalizeTimeString,
  normalizeUuidish
} from '../utils/validation.js';

const SCHEDULE_COLUMNS = 'id, schedule_code, trip_date, departure_time, arrival_time, capacity, available_seats, status, route_name, origin_port, destination_port, cancelled_at, cancel_reason, vessel_id, boat_name, registration_no';

const normalizeScheduleStatus = (status, { required = false, allowAll = false } = {}) => {
  const normalized = required
    ? normalizeOptionalString(status || 'open', { field: 'status', min: 4, max: 20 }) || 'open'
    : normalizeOptionalString(status, { field: 'status', min: allowAll ? 3 : 4, max: 20 });

  if (!normalized) return null;
  if (allowAll && normalized === 'all') return normalized;
  assert(['open', 'closed', 'cancelled'].includes(normalized), 'status is invalid');
  return normalized;
};

export const listSchedules = async (query = {}) => {
  const tripDate = normalizeDateString(query.trip_date || query.tripDate, 'trip_date', {
    required: false
  });
  const status = normalizeScheduleStatus(query.status, { required: false, allowAll: true });

  let builder = supabase
    .from('schedule_overview')
    .select(SCHEDULE_COLUMNS)
    .order('trip_date', { ascending: true })
    .order('departure_time', { ascending: true });

  if (tripDate) builder = builder.eq('trip_date', tripDate);
  if (status && status !== 'all') builder = builder.eq('status', status);

  const { data, error } = await builder;
  throwIfError(error);
  return data || [];
};

export const getScheduleById = async (id) => {
  const { data, error } = await supabase
    .from('schedule_overview')
    .select(SCHEDULE_COLUMNS)
    .eq('id', normalizeUuidish(id, 'id'))
    .single();

  throwIfError(error, 'Schedule not found', 404);
  return data;
};

export const ensureScheduleAvailable = async (id, passengerCount = 1) => {
  const schedule = await getScheduleById(id);
  assert(schedule.status === 'open', 'Schedule is not open for booking', 409);
  assert(Number(schedule.available_seats) >= passengerCount, 'Not enough seats available', 409);
  return schedule;
};

export const createSchedule = async (payload) => {
  const capacity = normalizePositiveInteger(payload.capacity, 'capacity');
  const availableSeats = payload.available_seats === undefined
    ? capacity
    : normalizePositiveInteger(payload.available_seats, 'available_seats');
  assert(availableSeats <= capacity, 'available_seats must be less than or equal to capacity');

  const { data, error } = await supabase
    .from('schedules')
    .insert([{
      schedule_code: normalizeOptionalString(payload.schedule_code, {
        field: 'schedule_code',
        min: 4,
        max: 40
      }) || generateScheduleCode(),
      trip_date: normalizeDateString(payload.trip_date || payload.tripDate, 'trip_date', {
        required: true
      }),
      departure_time: normalizeTimeString(payload.departure_time || payload.departureTime, 'departure_time'),
      arrival_time: normalizeTimeString(payload.arrival_time || payload.arrivalTime, 'arrival_time', {
        required: false
      }),
      vessel_id: payload.vessel_id ? normalizeUuidish(payload.vessel_id, 'vessel_id') : null,
      capacity,
      available_seats: availableSeats,
      status: normalizeScheduleStatus(payload.status || 'open', { required: true }),
      route_name: normalizeOptionalString(payload.route_name, {
        field: 'route_name',
        max: 120
      }),
      origin_port: normalizeOptionalString(payload.origin_port, {
        field: 'origin_port',
        max: 120
      }),
      destination_port: normalizeOptionalString(payload.destination_port, {
        field: 'destination_port',
        max: 120
      })
    }])
    .select('id')
    .single();

  throwIfError(error);
  return getScheduleById(data.id);
};

export const updateSchedule = async (id, payload) => {
  const scheduleId = normalizeUuidish(id, 'id');
  const updatePayload = {};

  if (payload.schedule_code !== undefined) {
    updatePayload.schedule_code = normalizeOptionalString(payload.schedule_code, {
      field: 'schedule_code',
      min: 4,
      max: 40
    });
  }
  if (payload.trip_date !== undefined || payload.tripDate !== undefined) {
    updatePayload.trip_date = normalizeDateString(payload.trip_date || payload.tripDate, 'trip_date', {
      required: true
    });
  }
  if (payload.departure_time !== undefined || payload.departureTime !== undefined) {
    updatePayload.departure_time = normalizeTimeString(payload.departure_time || payload.departureTime, 'departure_time');
  }
  if (payload.arrival_time !== undefined || payload.arrivalTime !== undefined) {
    updatePayload.arrival_time = normalizeTimeString(payload.arrival_time || payload.arrivalTime, 'arrival_time', {
      required: false
    });
  }
  if (payload.vessel_id !== undefined) {
    updatePayload.vessel_id = payload.vessel_id ? normalizeUuidish(payload.vessel_id, 'vessel_id') : null;
  }
  if (payload.capacity !== undefined) {
    updatePayload.capacity = normalizePositiveInteger(payload.capacity, 'capacity');
  }
  if (payload.available_seats !== undefined) {
    updatePayload.available_seats = normalizePositiveInteger(payload.available_seats, 'available_seats');
  }
  if (payload.status !== undefined) {
    updatePayload.status = normalizeScheduleStatus(payload.status, { required: true });
  }
  if (payload.route_name !== undefined) {
    updatePayload.route_name = normalizeOptionalString(payload.route_name, {
      field: 'route_name',
      max: 120
    });
  }
  if (payload.origin_port !== undefined) {
    updatePayload.origin_port = normalizeOptionalString(payload.origin_port, {
      field: 'origin_port',
      max: 120
    });
  }
  if (payload.destination_port !== undefined) {
    updatePayload.destination_port = normalizeOptionalString(payload.destination_port, {
      field: 'destination_port',
      max: 120
    });
  }

  const { error } = await supabase
    .from('schedules')
    .update(updatePayload)
    .eq('id', scheduleId);

  throwIfError(error, 'Schedule not found', 404);
  return getScheduleById(scheduleId);
};

export const openScheduleSales = async (id) => {
  const scheduleId = normalizeUuidish(id, 'id');
  const { error } = await supabase
    .from('schedules')
    .update({
      status: 'open',
      cancelled_at: null,
      cancel_reason: null
    })
    .eq('id', scheduleId);

  throwIfError(error, 'Schedule not found', 404);
  return getScheduleById(scheduleId);
};

export const closeScheduleSales = async (id) => {
  const scheduleId = normalizeUuidish(id, 'id');
  const { error } = await supabase
    .from('schedules')
    .update({
      status: 'closed'
    })
    .eq('id', scheduleId);

  throwIfError(error, 'Schedule not found', 404);
  return getScheduleById(scheduleId);
};

export const cancelSchedule = async (id, payload = {}) => {
  const scheduleId = normalizeUuidish(id, 'id');
  const { error } = await supabase
    .from('schedules')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: normalizeOptionalString(payload.reason || payload.cancel_reason, {
        field: 'reason',
        max: 255
      })
    })
    .eq('id', scheduleId);

  throwIfError(error, 'Schedule not found', 404);
  return getScheduleById(scheduleId);
};
