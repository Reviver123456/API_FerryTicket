import { createHandler as handle } from '../utils/controller.js';
import {
  createAgent,
  getAgentSales,
  listAgents,
  updateAgent
} from '../services/agent.service.js';

export const index = handle(listAgents, 'Agents loaded', {
  mapArgs: (req) => [req.query]
});

export const create = handle(createAgent, 'Agent created', {
  status: 201
});

export const update = handle(updateAgent, 'Agent updated', {
  mapArgs: (req) => [req.params.id, req.body]
});

export const sales = handle(getAgentSales, 'Agent sales loaded', {
  mapArgs: (req) => [req.params.id]
});
