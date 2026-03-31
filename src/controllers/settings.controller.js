import { createHandler as handle } from '../utils/controller.js';
import {
  exportSettings,
  importSettings,
  listSettings,
  updateSettings
} from '../services/settings.service.js';

export const index = handle(listSettings, 'Settings loaded', {
  mapArgs: (req) => [req.query]
});

export const update = handle(updateSettings, 'Settings updated', {
  mapArgs: (req) => [req.body, req.user]
});

export const exportData = handle(exportSettings, 'Settings exported', {
  mapArgs: () => []
});

export const importData = handle(importSettings, 'Settings imported', {
  mapArgs: (req) => [req.body, req.user]
});
