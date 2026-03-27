import { listSchedules, getScheduleById } from '../services/schedule.service.js';
import { ok } from '../utils/http.js';

export const index = async (req, res, next) => {
  try {
    const data = await listSchedules(req.query);
    return ok(res, data, 'Schedules loaded');
  } catch (error) {
    next(error);
  }
};

export const show = async (req, res, next) => {
  try {
    const data = await getScheduleById(req.params.id);
    return ok(res, data, 'Schedule loaded');
  } catch (error) {
    next(error);
  }
};
