import {
  createTicketType,
  getTicketTypeById,
  listTicketTypes,
  updateTicketType
} from '../services/ticketType.service.js';
import { createHandler as handle } from '../utils/controller.js';

export const index = handle(listTicketTypes, 'Ticket types loaded', {
  mapArgs: (req) => [req.query]
});

export const show = handle(getTicketTypeById, 'Ticket type loaded', {
  mapArgs: (req) => [req.params.id]
});

export const create = handle(createTicketType, 'Ticket type created', {
  status: 201
});

export const update = handle(updateTicketType, 'Ticket type updated', {
  mapArgs: (req) => [req.params.id, req.body]
});
