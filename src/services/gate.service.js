import { supabase } from '../config/supabase.js';
import { throwIfError } from './base.service.js';
import { normalizeString } from '../utils/validation.js';

export const validateGateScan = async ({ qr_token, gate_code = 'GATE-A', device_code = 'SCANNER-01' }) => {
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*, bookings(*), schedules(*)')
    .eq('qr_token', normalizeString(qr_token, { field: 'qr_token', min: 6, max: 32 }))
    .maybeSingle();

  throwIfError(ticketError);

  let result = 'deny';
  let reason = 'Ticket not found';

  if (ticket) {
    if (ticket.status !== 'active') {
      result = 'deny';
      reason = `Ticket status is ${ticket.status}`;
    } else if (ticket.bookings?.booking_status !== 'confirmed') {
      result = 'deny';
      reason = 'Booking not confirmed';
    } else {
      result = 'allow';
      reason = 'Valid ticket';

      const { error: updateTicketError } = await supabase
        .from('tickets')
        .update({ status: 'used', used_at: new Date().toISOString() })
        .eq('id', ticket.id);

      throwIfError(updateTicketError);
    }
  }

  const { error: logError } = await supabase
    .from('gate_logs')
    .insert([{
      ticket_id: ticket?.id || null,
      scan_time: new Date().toISOString(),
      gate_code: normalizeString(gate_code, { field: 'gate_code', min: 2, max: 40 }),
      device_code: normalizeString(device_code, { field: 'device_code', min: 2, max: 40 }),
      result,
      reason
    }]);

  throwIfError(logError);
  return { result, reason, ticket };
};
