import { supabase } from '../config/supabase.js';
import { assert, throwIfError } from './base.service.js';
import { hasPermission } from './access.service.js';
import {
  normalizeBoolean,
  normalizeOptionalString,
  normalizeOptionalUuidish,
  normalizeString,
  normalizeUuidish
} from '../utils/validation.js';

const normalizeChannel = (value) => {
  const normalized = normalizeString(value || 'internal', {
    field: 'channel',
    min: 3,
    max: 20
  });
  assert(['internal', 'email', 'sms', 'line'].includes(normalized), 'channel is invalid');
  return normalized;
};

const normalizeType = (value) => {
  const normalized = normalizeString(value || 'info', {
    field: 'type',
    min: 4,
    max: 20
  });
  assert(['info', 'success', 'warning', 'error'].includes(normalized), 'type is invalid');
  return normalized;
};

const normalizePriority = (value) => {
  const normalized = normalizeString(value || 'normal', {
    field: 'priority',
    min: 3,
    max: 20
  });
  assert(['low', 'normal', 'high'].includes(normalized), 'priority is invalid');
  return normalized;
};

const buildNotificationRows = async (payload, actor = null) => {
  const baseRow = {
    booking_id: normalizeOptionalUuidish(payload.booking_id, 'booking_id'),
    ticket_id: normalizeOptionalUuidish(payload.ticket_id, 'ticket_id'),
    created_by_user_id: actor?.id || normalizeOptionalUuidish(payload.created_by_user_id, 'created_by_user_id'),
    channel: normalizeChannel(payload.channel),
    type: normalizeType(payload.type),
    priority: normalizePriority(payload.priority),
    subject: normalizeOptionalString(payload.subject, {
      field: 'subject',
      max: 150
    }),
    message: normalizeString(payload.message, {
      field: 'message',
      min: 2,
      max: 2000
    }),
    status: 'sent',
    target_path: normalizeOptionalString(payload.target_path, {
      field: 'target_path',
      max: 255
    }),
    meta_json: payload.meta_json || {},
    sent_at: new Date().toISOString()
  };

  const broadcast = normalizeBoolean(payload.broadcast, 'broadcast', false);
  const userId = normalizeOptionalUuidish(payload.user_id, 'user_id');

  if (!broadcast) {
    return [{
      ...baseRow,
      user_id: userId
    }];
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .eq('status', 'active');

  throwIfError(error);

  return (users || []).map((user) => ({
    ...baseRow,
    user_id: user.id
  }));
};

export const listNotifications = async (query = {}, actor) => {
  assert(actor, 'Unauthorized', 401);

  let builder = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  const userId = normalizeOptionalUuidish(query.user_id, 'user_id');
  const isRead = query.is_read === undefined
    ? null
    : normalizeBoolean(query.is_read, 'is_read');

  if (hasPermission(actor, 'notifications.view') && userId) {
    builder = builder.eq('user_id', userId);
  } else {
    builder = builder.eq('user_id', actor.id);
  }

  if (isRead !== null) builder = builder.eq('is_read', isRead);

  const { data, error } = await builder;
  throwIfError(error);
  return data || [];
};

export const createNotification = async (payload, actor) => {
  const rows = await buildNotificationRows(payload, actor);
  const { data, error } = await supabase
    .from('notifications')
    .insert(rows)
    .select('*');

  throwIfError(error);
  return data || [];
};

export const markNotificationRead = async (id, actor) => {
  assert(actor, 'Unauthorized', 401);
  const notificationId = normalizeUuidish(id, 'id');

  let builder = supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('id', notificationId);

  if (!hasPermission(actor, 'notifications.view')) {
    builder = builder.eq('user_id', actor.id);
  }

  const { data, error } = await builder
    .select('*')
    .maybeSingle();

  throwIfError(error);
  assert(data, 'Notification not found', 404);
  return data;
};
