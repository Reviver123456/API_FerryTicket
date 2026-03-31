import {
  cancelSchedule,
  closeScheduleSales,
  createSchedule,
  getScheduleById,
  listSchedules,
  openScheduleSales,
  updateSchedule
} from '../services/schedule.service.js';
import { createHandler as handle } from '../utils/controller.js';

export const index = handle(listSchedules, 'Schedules loaded', {
  mapArgs: (req) => [req.query]
});

export const show = handle(getScheduleById, 'Schedule loaded', {
  mapArgs: (req) => [req.params.id]
});

export const create = handle(createSchedule, 'Schedule created', {
  status: 201
});

export const update = handle(updateSchedule, 'Schedule updated', {
  mapArgs: (req) => [req.params.id, req.body]
});

export const openSales = handle(openScheduleSales, 'Schedule sales opened', {
  mapArgs: (req) => [req.params.id]
});

export const closeSales = handle(closeScheduleSales, 'Schedule sales closed', {
  mapArgs: (req) => [req.params.id]
});

export const cancel = handle(cancelSchedule, 'Schedule cancelled', {
  mapArgs: (req) => [req.params.id, req.body]
});
