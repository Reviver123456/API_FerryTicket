import { createHandler as handle } from '../utils/controller.js';
import {
  createRole,
  listPermissions,
  listRoles,
  updateRole
} from '../services/role.service.js';

export const roles = handle(listRoles, 'Roles loaded', {
  mapArgs: () => []
});

export const permissions = handle(listPermissions, 'Permissions loaded', {
  mapArgs: () => []
});

export const roleCreate = handle(createRole, 'Role created', {
  status: 201
});

export const roleUpdate = handle(updateRole, 'Role updated', {
  mapArgs: (req) => [req.params.code, req.body]
});
