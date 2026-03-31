import { supabase } from '../config/supabase.js';
import { assert, throwIfError } from './base.service.js';
import {
  normalizeDateString,
  normalizeNonNegativeNumber,
  normalizeOptionalString,
  normalizeOptionalUuidish,
  normalizeString,
  normalizeUuidish
} from '../utils/validation.js';

const dateInRange = (targetDate, validFrom, validTo = null) => {
  if (!targetDate) return true;
  if (validFrom && targetDate < validFrom) return false;
  if (validTo && targetDate > validTo) return false;
  return true;
};

const rulesOverlap = (leftFrom, leftTo, rightFrom, rightTo) => {
  const normalizedLeftTo = leftTo || '9999-12-31';
  const normalizedRightTo = rightTo || '9999-12-31';
  return leftFrom <= normalizedRightTo && rightFrom <= normalizedLeftTo;
};

const scoreRule = (rule, { scheduleId = null, routeName = null } = {}) => {
  let score = 0;
  if (scheduleId && rule.schedule_id === scheduleId) score += 300;
  else if (!rule.schedule_id) score += 100;

  if (routeName && rule.route_name === routeName) score += 200;
  else if (!rule.route_name) score += 50;

  score += Number(rule.priority || 0);
  score += Number(rule.version_no || 0);
  return score;
};

const sortRules = (rules, context) => [...rules].sort((left, right) => {
  const scoreDiff = scoreRule(right, context) - scoreRule(left, context);
  if (scoreDiff !== 0) return scoreDiff;
  return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
});

const buildRouteName = (schedule) => {
  if (!schedule) return null;
  if (schedule.route_name) return schedule.route_name;
  if (schedule.origin_port && schedule.destination_port) {
    return `${schedule.origin_port} - ${schedule.destination_port}`;
  }
  return null;
};

const getTicketTypeFallbackPrice = async (ticketTypeId) => {
  const { data, error } = await supabase
    .from('ticket_types')
    .select('id, price, code, name_th')
    .eq('id', normalizeUuidish(ticketTypeId, 'ticket_type_id'))
    .single();

  throwIfError(error, 'Ticket type not found', 404);
  return data;
};

export const getSchedulePricingContext = async (scheduleId) => {
  const normalizedScheduleId = normalizeUuidish(scheduleId, 'schedule_id');
  const { data, error } = await supabase
    .from('schedules')
    .select('id, trip_date, route_name, origin_port, destination_port')
    .eq('id', normalizedScheduleId)
    .single();

  throwIfError(error, 'Schedule not found', 404);
  return {
    ...data,
    route_name: buildRouteName(data)
  };
};

export const listStandardPriceRules = async (query = {}) => {
  let builder = supabase
    .from('ticket_price_rules')
    .select('*, ticket_types(id, code, name_th), schedules(id, schedule_code, trip_date, route_name)')
    .order('valid_from', { ascending: false })
    .order('version_no', { ascending: false });

  const status = normalizeOptionalString(query.status, { field: 'status', min: 2, max: 20 });
  const ticketTypeId = normalizeOptionalUuidish(query.ticket_type_id, 'ticket_type_id');
  const scheduleId = normalizeOptionalUuidish(query.schedule_id, 'schedule_id');
  const routeName = normalizeOptionalString(query.route_name, { field: 'route_name', min: 2, max: 120 });

  if (status) builder = builder.eq('status', status);
  if (ticketTypeId) builder = builder.eq('ticket_type_id', ticketTypeId);
  if (scheduleId) builder = builder.eq('schedule_id', scheduleId);
  if (routeName) builder = builder.eq('route_name', routeName);

  const { data, error } = await builder;
  throwIfError(error);
  return data || [];
};

export const listAgentPriceRules = async (query = {}) => {
  let builder = supabase
    .from('agent_price_rules')
    .select('*, agents(id, agent_code, name, company_name), ticket_types(id, code, name_th), schedules(id, schedule_code, trip_date, route_name)')
    .order('valid_from', { ascending: false })
    .order('priority', { ascending: false });

  const status = normalizeOptionalString(query.status, { field: 'status', min: 2, max: 20 });
  const ticketTypeId = normalizeOptionalUuidish(query.ticket_type_id, 'ticket_type_id');
  const scheduleId = normalizeOptionalUuidish(query.schedule_id, 'schedule_id');
  const routeName = normalizeOptionalString(query.route_name, { field: 'route_name', min: 2, max: 120 });
  const agentId = normalizeOptionalUuidish(query.agent_id, 'agent_id');

  if (status) builder = builder.eq('status', status);
  if (ticketTypeId) builder = builder.eq('ticket_type_id', ticketTypeId);
  if (scheduleId) builder = builder.eq('schedule_id', scheduleId);
  if (routeName) builder = builder.eq('route_name', routeName);
  if (agentId) builder = builder.eq('agent_id', agentId);

  const { data, error } = await builder;
  throwIfError(error);
  return data || [];
};

export const resolveTicketPrice = async ({
  ticket_type_id,
  schedule_id = null,
  agent_id = null,
  trip_date = null,
  route_name = null
}) => {
  const normalizedTicketTypeId = normalizeUuidish(ticket_type_id, 'ticket_type_id');
  const normalizedScheduleId = normalizeOptionalUuidish(schedule_id, 'schedule_id');
  const normalizedAgentId = normalizeOptionalUuidish(agent_id, 'agent_id');

  let resolvedTripDate = normalizeDateString(trip_date, 'trip_date', { required: false });
  let resolvedRouteName = normalizeOptionalString(route_name, { field: 'route_name', min: 2, max: 120 });

  if (normalizedScheduleId) {
    const schedule = await getSchedulePricingContext(normalizedScheduleId);
    resolvedTripDate = resolvedTripDate || schedule.trip_date;
    resolvedRouteName = resolvedRouteName || schedule.route_name;
  }

  const fallbackTicketType = await getTicketTypeFallbackPrice(normalizedTicketTypeId);
  const standardRules = await listStandardPriceRules({
    status: 'active',
    ticket_type_id: normalizedTicketTypeId
  });

  const standardCandidates = standardRules.filter((rule) => {
    if (rule.schedule_id && normalizedScheduleId && rule.schedule_id !== normalizedScheduleId) return false;
    if (rule.schedule_id && !normalizedScheduleId) return false;
    if (rule.route_name && resolvedRouteName && rule.route_name !== resolvedRouteName) return false;
    if (rule.route_name && !resolvedRouteName) return false;
    return dateInRange(resolvedTripDate, rule.valid_from, rule.valid_to);
  });

  const baseRule = sortRules(standardCandidates, {
    scheduleId: normalizedScheduleId,
    routeName: resolvedRouteName
  })[0] || null;

  const basePrice = Number(baseRule?.price ?? fallbackTicketType.price);

  let agentRule = null;
  let finalPrice = basePrice;

  if (normalizedAgentId) {
    const agentRules = await listAgentPriceRules({
      status: 'active',
      ticket_type_id: normalizedTicketTypeId,
      agent_id: normalizedAgentId
    });

    const agentCandidates = agentRules.filter((rule) => {
      if (rule.schedule_id && normalizedScheduleId && rule.schedule_id !== normalizedScheduleId) return false;
      if (rule.schedule_id && !normalizedScheduleId) return false;
      if (rule.route_name && resolvedRouteName && rule.route_name !== resolvedRouteName) return false;
      if (rule.route_name && !resolvedRouteName) return false;
      return dateInRange(resolvedTripDate, rule.valid_from, rule.valid_to);
    });

    agentRule = sortRules(agentCandidates, {
      scheduleId: normalizedScheduleId,
      routeName: resolvedRouteName
    })[0] || null;

    if (agentRule) {
      finalPrice = agentRule.price !== null && agentRule.price !== undefined
        ? Number(agentRule.price)
        : Math.max(0, basePrice - Number(agentRule.discount_amount || 0));
    }
  }

  return {
    ticket_type: fallbackTicketType,
    trip_date: resolvedTripDate,
    route_name: resolvedRouteName,
    base_price: basePrice,
    final_price: finalPrice,
    base_rule: baseRule,
    agent_rule: agentRule
  };
};

export const assertStandardPriceRuleNoOverlap = async ({
  ticket_type_id,
  schedule_id = null,
  route_name = null,
  valid_from,
  valid_to = null,
  exclude_id = null
}) => {
  const rules = await listStandardPriceRules({
    status: 'active',
    ticket_type_id
  });

  const normalizedScheduleId = normalizeOptionalUuidish(schedule_id, 'schedule_id');
  const normalizedRouteName = normalizeOptionalString(route_name, { field: 'route_name', min: 2, max: 120 });
  const normalizedValidFrom = normalizeDateString(valid_from, 'valid_from', { required: true });
  const normalizedValidTo = normalizeDateString(valid_to, 'valid_to', { required: false });
  const normalizedExcludeId = normalizeOptionalUuidish(exclude_id, 'exclude_id');

  const conflict = rules.find((rule) => {
    if (normalizedExcludeId && rule.id === normalizedExcludeId) return false;
    if ((rule.schedule_id || null) !== normalizedScheduleId) return false;
    if ((rule.route_name || null) !== normalizedRouteName) return false;
    return rulesOverlap(normalizedValidFrom, normalizedValidTo, rule.valid_from, rule.valid_to);
  });

  assert(!conflict, 'Standard price overlaps with an existing active rule', 409);
};

export const assertAgentPriceRuleNoOverlap = async ({
  agent_id,
  ticket_type_id,
  schedule_id = null,
  route_name = null,
  valid_from,
  valid_to = null,
  exclude_id = null
}) => {
  const rules = await listAgentPriceRules({
    status: 'active',
    ticket_type_id,
    agent_id
  });

  const normalizedScheduleId = normalizeOptionalUuidish(schedule_id, 'schedule_id');
  const normalizedRouteName = normalizeOptionalString(route_name, { field: 'route_name', min: 2, max: 120 });
  const normalizedValidFrom = normalizeDateString(valid_from, 'valid_from', { required: true });
  const normalizedValidTo = normalizeDateString(valid_to, 'valid_to', { required: false });
  const normalizedExcludeId = normalizeOptionalUuidish(exclude_id, 'exclude_id');

  const conflict = rules.find((rule) => {
    if (normalizedExcludeId && rule.id === normalizedExcludeId) return false;
    if ((rule.schedule_id || null) !== normalizedScheduleId) return false;
    if ((rule.route_name || null) !== normalizedRouteName) return false;
    return rulesOverlap(normalizedValidFrom, normalizedValidTo, rule.valid_from, rule.valid_to);
  });

  assert(!conflict, 'Agent price overlaps with an existing active rule', 409);
};

export const normalizePriceRulePayload = (payload = {}, { requireAgent = false } = {}) => {
  const normalized = {
    agent_id: requireAgent ? normalizeUuidish(payload.agent_id, 'agent_id') : normalizeOptionalUuidish(payload.agent_id, 'agent_id'),
    route_name: normalizeOptionalString(payload.route_name, { field: 'route_name', min: 2, max: 120 }),
    schedule_id: normalizeOptionalUuidish(payload.schedule_id, 'schedule_id'),
    ticket_type_id: normalizeUuidish(payload.ticket_type_id, 'ticket_type_id'),
    price: payload.price === null || payload.price === undefined || payload.price === ''
      ? null
      : normalizeNonNegativeNumber(payload.price, 'price'),
    discount_amount: payload.discount_amount === null || payload.discount_amount === undefined || payload.discount_amount === ''
      ? 0
      : normalizeNonNegativeNumber(payload.discount_amount, 'discount_amount'),
    season_name: normalizeOptionalString(payload.season_name, { field: 'season_name', min: 2, max: 120 }),
    valid_from: normalizeDateString(payload.valid_from, 'valid_from', { required: true }),
    valid_to: normalizeDateString(payload.valid_to, 'valid_to', { required: false }),
    version_no: payload.version_no === undefined || payload.version_no === null
      ? 1
      : Number(payload.version_no),
    priority: payload.priority === undefined || payload.priority === null
      ? 0
      : Number(payload.priority),
    status: normalizeString(payload.status || 'active', { field: 'status', min: 2, max: 20 })
  };

  assert(Number.isInteger(normalized.version_no) && normalized.version_no >= 1, 'version_no must be a positive integer');
  assert(Number.isInteger(normalized.priority), 'priority must be an integer');
  assert(normalized.valid_to === null || normalized.valid_to >= normalized.valid_from, 'valid_to must be on or after valid_from');

  if (requireAgent) {
    assert(normalized.price !== null || normalized.discount_amount > 0, 'agent price or discount_amount is required');
  } else {
    assert(normalized.price !== null, 'price is required');
  }

  return normalized;
};
