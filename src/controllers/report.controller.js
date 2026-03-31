import { createHandler as handle } from '../utils/controller.js';
import {
  getDashboard,
  getPassengerReport,
  getSalesReport
} from '../services/report.service.js';

export const dashboard = handle(getDashboard, 'Dashboard loaded', {
  mapArgs: (req) => [req.query]
});

export const sales = handle(getSalesReport, 'Sales report loaded', {
  mapArgs: (req) => [req.query]
});

export const passengers = handle(getPassengerReport, 'Passenger report loaded', {
  mapArgs: (req) => [req.query]
});
