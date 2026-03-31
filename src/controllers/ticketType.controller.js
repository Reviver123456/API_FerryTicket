import { getTicketTypeById, listTicketTypes } from '../services/ticketType.service.js';
import { createHandler as handle } from '../utils/controller.js';

export const index = handle(listTicketTypes, 'Ticket types loaded', {
  mapArgs: (req) => [req.query]
});

export const show = handle(getTicketTypeById, 'Ticket type loaded', {
  mapArgs: (req) => [req.params.id]
});
