import { supabase } from '../config/supabase.js';
import { throwIfError } from './base.service.js';
import {
  normalizeBoolean,
  normalizeOptionalString,
  normalizeString,
  normalizeUuidish
} from '../utils/validation.js';

const TICKET_TYPE_COLUMNS = 'id, code, name_th, name_en, description, benefit_text, display_order, requires_document, status, created_at, updated_at';

export const listTicketTypes = async (query = {}) => {
  const normalizedStatus = normalizeOptionalString(query.status, {
    field: 'status',
    min: 2,
    max: 32
  });
  const normalizedCode = normalizeOptionalString(query.code, {
    field: 'code',
    min: 2,
    max: 32
  })?.toUpperCase();

  let builder = supabase
    .from('ticket_types')
    .select(TICKET_TYPE_COLUMNS)
    .order('display_order', { ascending: true })
    .order('code', { ascending: true });

  if (normalizedStatus && normalizedStatus !== 'all') builder = builder.eq('status', normalizedStatus);
  if (!normalizedStatus) builder = builder.eq('status', 'active');
  if (normalizedCode) builder = builder.eq('code', normalizedCode);

  const { data, error } = await builder;
  throwIfError(error);
  return data || [];
};

export const getTicketTypeById = async (id) => {
  const normalizedId = normalizeUuidish(id, 'id');
  const { data, error } = await supabase
    .from('ticket_types')
    .select(TICKET_TYPE_COLUMNS)
    .eq('id', normalizedId)
    .single();

  throwIfError(error, 'Ticket type not found', 404);
  return data;
};

export const createTicketType = async (payload) => {
  const { data, error } = await supabase
    .from('ticket_types')
    .insert([{
      code: normalizeString(payload.code, {
        field: 'code',
        min: 2,
        max: 32
      }).toUpperCase(),
      name_th: normalizeString(payload.name_th, {
        field: 'name_th',
        min: 2,
        max: 120
      }),
      name_en: normalizeOptionalString(payload.name_en, {
        field: 'name_en',
        max: 120
      }),
      description: normalizeOptionalString(payload.description, {
        field: 'description',
        max: 255
      }),
      benefit_text: normalizeOptionalString(payload.benefit_text, {
        field: 'benefit_text',
        max: 255
      }),
      display_order: Number(payload.display_order || 0),
      requires_document: normalizeBoolean(payload.requires_document, 'requires_document', false),
      status: normalizeString(payload.status || 'active', {
        field: 'status',
        min: 6,
        max: 20
      })
    }])
    .select(TICKET_TYPE_COLUMNS)
    .single();

  throwIfError(error);
  return data;
};

export const updateTicketType = async (id, payload) => {
  const normalizedId = normalizeUuidish(id, 'id');
  const updatePayload = {};

  if (payload.code !== undefined) {
    updatePayload.code = normalizeString(payload.code, {
      field: 'code',
      min: 2,
      max: 32
    }).toUpperCase();
  }
  if (payload.name_th !== undefined) {
    updatePayload.name_th = normalizeString(payload.name_th, {
      field: 'name_th',
      min: 2,
      max: 120
    });
  }
  if (payload.name_en !== undefined) {
    updatePayload.name_en = normalizeOptionalString(payload.name_en, {
      field: 'name_en',
      max: 120
    });
  }
  if (payload.description !== undefined) {
    updatePayload.description = normalizeOptionalString(payload.description, {
      field: 'description',
      max: 255
    });
  }
  if (payload.benefit_text !== undefined) {
    updatePayload.benefit_text = normalizeOptionalString(payload.benefit_text, {
      field: 'benefit_text',
      max: 255
    });
  }
  if (payload.display_order !== undefined) {
    updatePayload.display_order = Number(payload.display_order);
  }
  if (payload.requires_document !== undefined) {
    updatePayload.requires_document = normalizeBoolean(payload.requires_document, 'requires_document');
  }
  if (payload.status !== undefined) {
    updatePayload.status = normalizeString(payload.status, {
      field: 'status',
      min: 6,
      max: 20
    });
  }

  const { data, error } = await supabase
    .from('ticket_types')
    .update(updatePayload)
    .eq('id', normalizedId)
    .select(TICKET_TYPE_COLUMNS)
    .single();

  throwIfError(error, 'Ticket type not found', 404);
  return data;
};
