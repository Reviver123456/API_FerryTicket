import { supabase } from '../config/supabase.js';
import { generateAgentCode } from '../utils/ids.js';
import { assert, throwIfError } from './base.service.js';
import {
  normalizeNonNegativeNumber,
  normalizeOptionalString,
  normalizePhone,
  normalizeString,
  normalizeUuidish
} from '../utils/validation.js';

const AGENT_COLUMNS = 'id, agent_code, name, company_name, contact_name, email, phone, payment_terms_days, credit_limit, status, contract_notes, address, metadata, created_at, updated_at';

export const listAgents = async (query = {}) => {
  let builder = supabase
    .from('agents')
    .select(AGENT_COLUMNS)
    .order('created_at', { ascending: false });

  const status = normalizeOptionalString(query.status, {
    field: 'status',
    min: 4,
    max: 20
  });
  if (status) builder = builder.eq('status', status);

  const { data, error } = await builder;
  throwIfError(error);
  return data || [];
};

export const createAgent = async (payload) => {
  const { data, error } = await supabase
    .from('agents')
    .insert([{
      agent_code: normalizeOptionalString(payload.agent_code, {
        field: 'agent_code',
        min: 3,
        max: 30
      }) || generateAgentCode(),
      name: normalizeString(payload.name, {
        field: 'name',
        min: 2,
        max: 120
      }),
      company_name: normalizeOptionalString(payload.company_name, {
        field: 'company_name',
        max: 120
      }),
      contact_name: normalizeOptionalString(payload.contact_name, {
        field: 'contact_name',
        max: 120
      }),
      email: normalizeOptionalString(payload.email, {
        field: 'email',
        max: 255
      }),
      phone: normalizePhone(payload.phone, { required: false }),
      payment_terms_days: payload.payment_terms_days === undefined
        ? 0
        : normalizeNonNegativeNumber(payload.payment_terms_days, 'payment_terms_days'),
      credit_limit: payload.credit_limit === undefined
        ? 0
        : normalizeNonNegativeNumber(payload.credit_limit, 'credit_limit'),
      status: normalizeString(payload.status || 'active', {
        field: 'status',
        min: 4,
        max: 20
      }),
      contract_notes: normalizeOptionalString(payload.contract_notes, {
        field: 'contract_notes',
        max: 500
      }),
      address: normalizeOptionalString(payload.address, {
        field: 'address',
        max: 500
      }),
      metadata: payload.metadata || {}
    }])
    .select(AGENT_COLUMNS)
    .single();

  throwIfError(error);
  return data;
};

export const updateAgent = async (id, payload) => {
  const agentId = normalizeUuidish(id, 'id');
  const updatePayload = {};

  if (payload.agent_code !== undefined) {
    updatePayload.agent_code = normalizeString(payload.agent_code, {
      field: 'agent_code',
      min: 3,
      max: 30
    });
  }
  if (payload.name !== undefined) {
    updatePayload.name = normalizeString(payload.name, {
      field: 'name',
      min: 2,
      max: 120
    });
  }
  if (payload.company_name !== undefined) {
    updatePayload.company_name = normalizeOptionalString(payload.company_name, {
      field: 'company_name',
      max: 120
    });
  }
  if (payload.contact_name !== undefined) {
    updatePayload.contact_name = normalizeOptionalString(payload.contact_name, {
      field: 'contact_name',
      max: 120
    });
  }
  if (payload.email !== undefined) {
    updatePayload.email = normalizeOptionalString(payload.email, {
      field: 'email',
      max: 255
    });
  }
  if (payload.phone !== undefined) {
    updatePayload.phone = normalizePhone(payload.phone, { required: false });
  }
  if (payload.payment_terms_days !== undefined) {
    updatePayload.payment_terms_days = normalizeNonNegativeNumber(payload.payment_terms_days, 'payment_terms_days');
  }
  if (payload.credit_limit !== undefined) {
    updatePayload.credit_limit = normalizeNonNegativeNumber(payload.credit_limit, 'credit_limit');
  }
  if (payload.status !== undefined) {
    updatePayload.status = normalizeString(payload.status, {
      field: 'status',
      min: 4,
      max: 20
    });
  }
  if (payload.contract_notes !== undefined) {
    updatePayload.contract_notes = normalizeOptionalString(payload.contract_notes, {
      field: 'contract_notes',
      max: 500
    });
  }
  if (payload.address !== undefined) {
    updatePayload.address = normalizeOptionalString(payload.address, {
      field: 'address',
      max: 500
    });
  }
  if (payload.metadata !== undefined) {
    updatePayload.metadata = payload.metadata || {};
  }

  const { data, error } = await supabase
    .from('agents')
    .update(updatePayload)
    .eq('id', agentId)
    .select(AGENT_COLUMNS)
    .single();

  throwIfError(error, 'Agent not found', 404);
  return data;
};

export const getAgentSales = async (id) => {
  const agentId = normalizeUuidish(id, 'id');

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select(AGENT_COLUMNS)
    .eq('id', agentId)
    .maybeSingle();

  throwIfError(agentError);
  assert(agent, 'Agent not found', 404);

  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select('id, booking_no, total_amount, payment_status, booking_status, created_at')
    .eq('agent_id', agentId);

  throwIfError(bookingError);
  const rows = bookings || [];

  return {
    agent,
    summary: {
      booking_count: rows.length,
      paid_booking_count: rows.filter((row) => row.payment_status === 'paid').length,
      total_amount: rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0)
    },
    bookings: rows
  };
};
