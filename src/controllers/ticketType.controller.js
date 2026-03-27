import { ok } from '../utils/http.js';
import { getTicketTypeById, listTicketTypes } from '../services/ticketType.service.js';

export const index = async (req, res, next) => {
  try {
    const data = await listTicketTypes(req.query);
    return ok(res, data, 'Ticket types loaded');
  } catch (error) {
    next(error);
  }
};

export const show = async (req, res, next) => {
  try {
    const data = await getTicketTypeById(req.params.id);
    return ok(res, data, 'Ticket type loaded');
  } catch (error) {
    next(error);
  }
};
