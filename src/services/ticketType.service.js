import { supabase } from '../config/supabase.js';
import { throwIfError } from './base.service.js';
import { normalizeOptionalString, normalizeString, normalizeUuidish } from '../utils/validation.js';

const PUBLIC_TICKET_TYPE_COLUMNS = 'id, name_th, code, price, description, benefit_text, status, created_at, updated_at';

export const listTicketTypes = async (query = {}) => {
  const normalizedStatus = normalizeString(query.status || 'active', {
    field: 'status',
    min: 2,
    max: 32
  }).toLowerCase();
  const normalizedCode = normalizeOptionalString(query.code, {
    field: 'code',
    min: 2,
    max: 32
  })?.toUpperCase();

  let builder = supabase
    .from('ticket_types')
    .select(PUBLIC_TICKET_TYPE_COLUMNS)
    .order('price', { ascending: true })
    .order('code', { ascending: true });

  if (normalizedStatus !== 'all') builder = builder.eq('status', normalizedStatus);
  if (normalizedCode) builder = builder.eq('code', normalizedCode);

  const { data, error } = await builder;
  throwIfError(error);
  return data;
};

export const getTicketTypeById = async (id) => {
  const normalizedId = normalizeUuidish(id, 'id');
  const { data, error } = await supabase
    .from('ticket_types')
    .select(PUBLIC_TICKET_TYPE_COLUMNS)
    .eq('id', normalizedId)
    .eq('status', 'active')
    .single();

  throwIfError(error, 'Ticket type not found', 404);
  return data;
};
