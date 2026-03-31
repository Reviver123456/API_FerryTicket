import { createHandler as handle } from '../utils/controller.js';
import {
  createManagedUser,
  getManagedUserById,
  listUsers,
  resetManagedUserPassword,
  updateManagedUser
} from '../services/user.service.js';

export const index = handle(listUsers, 'Users loaded', {
  mapArgs: (req) => [req.query]
});

export const show = handle(getManagedUserById, 'User loaded', {
  mapArgs: (req) => [req.params.id]
});

export const create = handle(createManagedUser, 'User created', {
  status: 201
});

export const update = handle(updateManagedUser, 'User updated', {
  mapArgs: (req) => [req.params.id, req.body]
});

export const resetPassword = handle(resetManagedUserPassword, 'User password reset', {
  mapArgs: (req) => [req.params.id, req.body]
});
