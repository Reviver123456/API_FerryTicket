import { supabase } from '../config/supabase.js';
import { assert, throwIfError } from './base.service.js';
import {
  normalizeDateString,
  normalizeOptionalString,
  normalizeOptionalUuidish,
  normalizeString,
  normalizeUuidish
} from '../utils/validation.js';

const PRICE_COLUMNS = 'id, price_type, day_type, ticket_type_id, agent_id, effective_from, effective_to, amount, currency, status, created_by_user_id, updated_by_user_id, created_at, updated_at';
const PRICE_DAY_TYPES = ['all', 'weekday', 'weekend', 'holiday'];

const normalizePriceType = (value, { required = false } = {}) => {
  const normalized = required
    ? normalizeString(value, { field: 'price_type', min: 5, max: 20 })
    : normalizeOptionalString(value, { field: 'price_type', min: 5, max: 20 });

  if (!normalized) return null;
  assert(['standard', 'agent'].includes(normalized), 'price_type is invalid');
  return normalized;
};

const normalizePriceDayType = (value, { required = false } = {}) => {
  const normalized = required
    ? normalizeString(value, { field: 'day_type', min: 3, max: 20 })
    : normalizeOptionalString(value, { field: 'day_type', min: 3, max: 20 });

  if (!normalized) return null;
  assert(PRICE_DAY_TYPES.includes(normalized), 'day_type is invalid');
  return normalized;
};

const normalizePriceStatus = (value, { required = false } = {}) => {
  const normalized = required
    ? normalizeString(value, { field: 'status', min: 6, max: 20 })
    : normalizeOptionalString(value, { field: 'status', min: 6, max: 20 });

  if (!normalized) return null;
  assert(['active', 'inactive'].includes(normalized), 'status is invalid');
  return normalized;
};

const normalizeAmount = (value) => {
  const amount = Number(value);
  assert(Number.isFinite(amount) && amount >= 0, 'amount must be a non-negative number');
  return amount;
};

const compareDates = (left, right) => new Date(left).getTime() - new Date(right).getTime();

const getDayTypePriority = (candidateDayType, targetDayType) => {
  if (candidateDayType === targetDayType) return 2;
  if (candidateDayType === 'all') return 1;
  return 0;
};

const loadHolidayByDate = async (effectiveDate) => {
  const { data, error } = await supabase
    .from('holiday_calendar')
    .select('holiday_date, name')
    .eq('holiday_date', effectiveDate)
    .eq('is_active', true)
    .limit(1);

  throwIfError(error);
  return data?.[0] || null;
};

const resolveEffectiveDayType = async (effectiveDate, requestedDayType = null) => {
  const normalizedRequestedDayType = normalizePriceDayType(requestedDayType, { required: false });

  if (normalizedRequestedDayType && normalizedRequestedDayType !== 'all') {
    return {
      day_type: normalizedRequestedDayType,
      holiday_name: null
    };
  }

  const holiday = await loadHolidayByDate(effectiveDate);
  if (holiday) {
    return {
      day_type: 'holiday',
      holiday_name: holiday.name || null
    };
  }

  const dayOfWeek = new Date(`${effectiveDate}T12:00:00Z`).getUTCDay();
  return {
    day_type: dayOfWeek === 0 || dayOfWeek === 6 ? 'weekend' : 'weekday',
    holiday_name: null
  };
};

const pickActiveRule = (prices, effectiveDate, targetDayType) => {
  const targetDate = effectiveDate || new Date().toISOString().slice(0, 10);
  const candidates = (prices || [])
    .filter((price) => price.status === 'active')
    .filter((price) => price.effective_from <= targetDate)
    .filter((price) => !price.effective_to || price.effective_to >= targetDate)
    .filter((price) => {
      const candidateDayType = price.day_type || 'all';
      return candidateDayType === targetDayType || candidateDayType === 'all';
    })
    .sort((left, right) => {
      const priorityDiff = getDayTypePriority(right.day_type || 'all', targetDayType)
        - getDayTypePriority(left.day_type || 'all', targetDayType);
      if (priorityDiff !== 0) return priorityDiff;
      return compareDates(right.effective_from, left.effective_from);
    });

  return candidates[0] || null;
};

export const listPrices = async (query = {}) => {
  let builder = supabase
    .from('prices')
    .select(PRICE_COLUMNS)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false });

  const priceType = normalizePriceType(query.price_type, { required: false });
  const dayType = normalizePriceDayType(query.day_type, { required: false });
  const status = normalizePriceStatus(query.status, { required: false });
  const ticketTypeId = normalizeOptionalUuidish(query.ticket_type_id, 'ticket_type_id');
  const agentId = normalizeOptionalUuidish(query.agent_id, 'agent_id');

  if (priceType) builder = builder.eq('price_type', priceType);
  if (dayType) builder = builder.eq('day_type', dayType);
  if (status) builder = builder.eq('status', status);
  if (ticketTypeId) builder = builder.eq('ticket_type_id', ticketTypeId);
  if (agentId) builder = builder.eq('agent_id', agentId);

  const { data, error } = await builder;
  throwIfError(error);
  return data || [];
};

export const getPriceById = async (id) => {
  const { data, error } = await supabase
    .from('prices')
    .select(PRICE_COLUMNS)
    .eq('id', normalizeUuidish(id, 'id'))
    .single();

  throwIfError(error, 'Price not found', 404);
  return data;
};

export const resolvePricePreview = async ({ ticket_type_id, agent_id = null, effective_date = null, day_type = null }) => {
  const ticketTypeId = normalizeUuidish(ticket_type_id, 'ticket_type_id');
  const agentId = normalizeOptionalUuidish(agent_id, 'agent_id');
  const effectiveDate = normalizeDateString(effective_date || new Date().toISOString().slice(0, 10), 'effective_date', {
    required: true
  });
  const resolvedDayType = await resolveEffectiveDayType(effectiveDate, day_type);

  const standardPrices = await listPrices({
    price_type: 'standard',
    ticket_type_id: ticketTypeId,
    status: 'active'
  });
  const agentPrices = agentId
    ? await listPrices({
      price_type: 'agent',
      ticket_type_id: ticketTypeId,
      agent_id: agentId,
      status: 'active'
    })
    : [];

  const standardRule = pickActiveRule(standardPrices, effectiveDate, resolvedDayType.day_type);
  assert(standardRule, 'No active standard price found', 404);

  const agentRule = agentId ? pickActiveRule(agentPrices, effectiveDate, resolvedDayType.day_type) : null;
  const activeRule = agentRule || standardRule;

  return {
    ticket_type_id: ticketTypeId,
    agent_id: agentId,
    effective_date: effectiveDate,
    resolved_day_type: resolvedDayType.day_type,
    resolved_holiday_name: resolvedDayType.holiday_name,
    matched_price_id: activeRule.id,
    matched_price_type: activeRule.price_type,
    matched_day_type: activeRule.day_type || 'all',
    currency: activeRule.currency,
    amount: Number(activeRule.amount),
    standard_price: Number(standardRule.amount),
    standard_day_type: standardRule.day_type || 'all',
    agent_price: agentRule ? Number(agentRule.amount) : null,
    agent_day_type: agentRule ? (agentRule.day_type || 'all') : null
  };
};

export const createPrice = async (payload, actor = null) => {
  const priceType = normalizePriceType(payload.price_type, { required: true });
  const agentId = priceType === 'agent'
    ? normalizeUuidish(payload.agent_id, 'agent_id')
    : null;

  const { data, error } = await supabase
    .from('prices')
    .insert([{
      price_type: priceType,
      day_type: normalizePriceDayType(payload.day_type || 'all', { required: true }),
      ticket_type_id: normalizeUuidish(payload.ticket_type_id, 'ticket_type_id'),
      agent_id: agentId,
      effective_from: normalizeDateString(payload.effective_from, 'effective_from', { required: true }),
      effective_to: normalizeDateString(payload.effective_to, 'effective_to', { required: false }),
      amount: normalizeAmount(payload.amount),
      currency: normalizeString(payload.currency || 'THB', {
        field: 'currency',
        min: 3,
        max: 10
      }).toUpperCase(),
      status: normalizePriceStatus(payload.status || 'active', { required: true }),
      created_by_user_id: actor?.id || null,
      updated_by_user_id: actor?.id || null
    }])
    .select(PRICE_COLUMNS)
    .single();

  throwIfError(error);
  return data;
};

export const updatePrice = async (id, payload, actor = null) => {
  const updatePayload = {};

  if (payload.price_type !== undefined) {
    updatePayload.price_type = normalizePriceType(payload.price_type, { required: true });
  }
  if (payload.day_type !== undefined) {
    updatePayload.day_type = normalizePriceDayType(payload.day_type, { required: true });
  }
  if (payload.ticket_type_id !== undefined) {
    updatePayload.ticket_type_id = normalizeUuidish(payload.ticket_type_id, 'ticket_type_id');
  }
  if (payload.agent_id !== undefined) {
    updatePayload.agent_id = payload.agent_id ? normalizeUuidish(payload.agent_id, 'agent_id') : null;
  }
  if (payload.effective_from !== undefined) {
    updatePayload.effective_from = normalizeDateString(payload.effective_from, 'effective_from', { required: true });
  }
  if (payload.effective_to !== undefined) {
    updatePayload.effective_to = normalizeDateString(payload.effective_to, 'effective_to', { required: false });
  }
  if (payload.amount !== undefined) {
    updatePayload.amount = normalizeAmount(payload.amount);
  }
  if (payload.currency !== undefined) {
    updatePayload.currency = normalizeString(payload.currency, {
      field: 'currency',
      min: 3,
      max: 10
    }).toUpperCase();
  }
  if (payload.status !== undefined) {
    updatePayload.status = normalizePriceStatus(payload.status, { required: true });
  }
  updatePayload.updated_by_user_id = actor?.id || null;

  const { data, error } = await supabase
    .from('prices')
    .update(updatePayload)
    .eq('id', normalizeUuidish(id, 'id'))
    .select(PRICE_COLUMNS)
    .single();

  throwIfError(error, 'Price not found', 404);
  return data;
};
