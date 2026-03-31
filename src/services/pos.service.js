import { supabase } from '../config/supabase.js';
import { assert, throwIfError } from './base.service.js';
import {
  createBookingDraft,
  getBookingByRef,
  replaceBookingPassengers,
  updateBookingDetails
} from './booking.service.js';
import { markBookingPaid } from './payment.service.js';
import { normalizeUuidish } from '../utils/validation.js';

export const createPosSale = async (payload, actor) => {
  const booking = await createBookingDraft({
    ...payload,
    source_channel: 'pos'
  }, actor);

  await updateBookingDetails(booking.booking_no, {
    contact_name: payload.contact_name,
    contact_email: payload.contact_email,
    contact_phone: payload.contact_phone,
    guest_email: payload.guest_email,
    guest_phone: payload.guest_phone,
    notes: payload.notes
  }, actor, null);

  await replaceBookingPassengers(booking.booking_no, payload.passengers || [], actor, null);
  await markBookingPaid(booking.booking_no, {
    payment_method: payload.payment_method || 'cash',
    transaction_id: payload.transaction_id || null,
    note: 'POS walk-in sale'
  }, actor);

  return getBookingByRef(booking.booking_no);
};

export const listPosSales = async () => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('source_channel', 'pos')
    .order('created_at', { ascending: false });

  throwIfError(error);
  return data || [];
};

export const getPosSaleById = async (id) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('booking_no')
    .eq('id', normalizeUuidish(id, 'id'))
    .eq('source_channel', 'pos')
    .maybeSingle();

  throwIfError(error, 'POS sale not found', 404);
  assert(data, 'POS sale not found', 404);
  return getBookingByRef(data.booking_no);
};
