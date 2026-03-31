import { supabase } from '../config/supabase.js';
import { assert, throwIfError } from './base.service.js';
import { normalizeOptionalString } from '../utils/validation.js';

export const listSettings = async (query = {}) => {
  let builder = supabase
    .from('system_settings')
    .select('*')
    .order('category', { ascending: true })
    .order('key', { ascending: true });

  const category = normalizeOptionalString(query.category, {
    field: 'category',
    min: 2,
    max: 50
  });
  if (category) builder = builder.eq('category', category);

  const { data, error } = await builder;
  throwIfError(error);
  return data || [];
};

export const updateSettings = async (payload, actor) => {
  const rows = Array.isArray(payload.settings) ? payload.settings : Array.isArray(payload) ? payload : [];
  assert(rows.length > 0, 'settings must be a non-empty array');
  const upsertRows = rows.map((row) => ({
    category: row.category,
    key: row.key,
    value_json: row.value_json || row.value || {},
    description: row.description || null,
    is_public: Boolean(row.is_public),
    updated_by_user_id: actor?.id || null
  }));

  const { data, error } = await supabase
    .from('system_settings')
    .upsert(upsertRows, {
      onConflict: 'category,key'
    })
    .select('*');

  throwIfError(error);
  return data || [];
};

export const exportSettings = async () => ({
  settings: await listSettings({})
});

export const importSettings = async (payload, actor) => updateSettings(payload, actor);
