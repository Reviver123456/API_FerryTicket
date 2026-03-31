import { listSchedules, getScheduleById } from '../services/schedule.service.js';
import { createHandler as handle } from '../utils/controller.js';

export const index = handle(listSchedules, 'Schedules loaded', {
  mapArgs: (req) => [req.query]
});

export const show = handle(getScheduleById, 'Schedule loaded', {
  mapArgs: (req) => [req.params.id]
});
