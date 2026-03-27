import { supabase } from '../config/supabase.js';
import { throwIfError } from './base.service.js';
import { normalizeEnum, normalizeOptionalString, normalizeString } from '../utils/validation.js';

export const sendNotification = async ({ booking_id = null, ticket_id = null, user_id = null, channel = 'email', subject, message }) => {
  const { data, error } = await supabase
    .from('notifications')
    .insert([{
      booking_id,
      ticket_id,
      user_id,
      channel: normalizeEnum(channel, ['email', 'sms', 'line'], 'channel'),
      subject: normalizeOptionalString(subject, { field: 'subject', max: 150 }),
      message: normalizeString(message, { field: 'message', min: 2, max: 2000 }),
      status: 'sent',
      sent_at: new Date().toISOString()
    }])
    .select('*')
    .single();

  throwIfError(error);
  return data;
};
