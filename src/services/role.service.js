import { supabase } from '../config/supabase.js';
import { ALL_PERMISSIONS } from '../constants/permissions.js';
import { assert, throwIfError } from './base.service.js';
import { getRoleByCode, ROLE_COLUMNS, sanitizeRole } from './access.service.js';
import { normalizeJsonArrayOfStrings, normalizeOptionalString, normalizeString } from '../utils/validation.js';

const normalizePermissions = (permissions) => {
  const normalized = normalizeJsonArrayOfStrings(permissions || [], 'permissions');
  for (const permission of normalized) {
    assert(ALL_PERMISSIONS.includes(permission) || permission === '*', `Unknown permission: ${permission}`);
  }
  return normalized;
};

export const listRoles = async () => {
  const { data, error } = await supabase
    .from('roles')
    .select(ROLE_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true });

  throwIfError(error);
  return (data || []).map(sanitizeRole);
};

export const listPermissions = async () => ({
  permissions: ALL_PERMISSIONS
});

export const createRole = async (payload) => {
  const code = normalizeString(payload.code, {
    field: 'code',
    min: 2,
    max: 50
  }).toLowerCase();
  const name = normalizeString(payload.name, {
    field: 'name',
    min: 2,
    max: 120
  });
  const permissions = normalizePermissions(payload.permissions || []);

  const { data, error } = await supabase
    .from('roles')
    .insert([{
      code,
      name,
      description: normalizeOptionalString(payload.description, {
        field: 'description',
        max: 255
      }),
      permissions,
      status: normalizeString(payload.status || 'active', {
        field: 'status',
        min: 6,
        max: 20
      }),
      sort_order: Number(payload.sort_order || 0)
    }])
    .select(ROLE_COLUMNS)
    .single();

  throwIfError(error);
  return sanitizeRole(data);
};

export const updateRole = async (code, payload) => {
  const roleCode = normalizeString(code, {
    field: 'code',
    min: 2,
    max: 50
  }).toLowerCase();
  const existing = await getRoleByCode(roleCode);
  assert(existing, 'Role not found', 404);

  const updatePayload = {};
  if (payload.name !== undefined) {
    updatePayload.name = normalizeString(payload.name, {
      field: 'name',
      min: 2,
      max: 120
    });
  }
  if (payload.description !== undefined) {
    updatePayload.description = normalizeOptionalString(payload.description, {
      field: 'description',
      max: 255
    });
  }
  if (payload.permissions !== undefined) {
    updatePayload.permissions = normalizePermissions(payload.permissions);
  }
  if (payload.status !== undefined) {
    updatePayload.status = normalizeString(payload.status, {
      field: 'status',
      min: 6,
      max: 20
    });
  }
  if (payload.sort_order !== undefined) {
    const sortOrder = Number(payload.sort_order);
    assert(Number.isInteger(sortOrder), 'sort_order must be an integer');
    updatePayload.sort_order = sortOrder;
  }

  const { data, error } = await supabase
    .from('roles')
    .update(updatePayload)
    .eq('code', roleCode)
    .select(ROLE_COLUMNS)
    .single();

  throwIfError(error);
  return sanitizeRole(data);
};
