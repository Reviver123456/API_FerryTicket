import { createHandler as handle } from '../utils/controller.js';
import {
  getTicketByNo,
  listTickets,
  resendTickets
} from '../services/ticket.service.js';

export const index = handle(listTickets, 'Tickets loaded', {
  mapArgs: (req) => [req.query, req.user]
});

export const show = handle(getTicketByNo, 'Ticket loaded', {
  mapArgs: (req) => [req.params.ticketNo, req.user || null, req.query.contact_email || null]
});

export const resend = handle(resendTickets, 'Tickets resent', {
  mapArgs: (req) => [{
    booking_no: req.body.booking_no || req.body.bookingNo,
    contact_email: req.body.contact_email || req.query.contact_email || null
  }, req.user || null]
});
