import { createHandler as handle } from '../utils/controller.js';
import {
  createPosSale,
  getPosSaleById,
  listPosSales
} from '../services/pos.service.js';

export const create = handle(createPosSale, 'POS sale created', {
  status: 201,
  mapArgs: (req) => [req.body, req.user]
});

export const index = handle(listPosSales, 'POS sales loaded', {
  mapArgs: () => []
});

export const show = handle(getPosSaleById, 'POS sale loaded', {
  mapArgs: (req) => [req.params.id]
});
