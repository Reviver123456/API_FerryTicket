import { createHandler as handle } from '../utils/controller.js';
import {
  createPrice,
  getPriceById,
  listPrices,
  resolvePricePreview,
  updatePrice
} from '../services/price.service.js';

export const index = handle(listPrices, 'Prices loaded', {
  mapArgs: (req) => [req.query]
});

export const show = handle(getPriceById, 'Price loaded', {
  mapArgs: (req) => [req.params.id]
});

export const preview = handle(resolvePricePreview, 'Price preview loaded', {
  mapArgs: (req) => [req.query]
});

export const create = handle(createPrice, 'Price created', {
  status: 201,
  mapArgs: (req) => [req.body, req.user]
});

export const update = handle(updatePrice, 'Price updated', {
  mapArgs: (req) => [req.params.id, req.body, req.user]
});
