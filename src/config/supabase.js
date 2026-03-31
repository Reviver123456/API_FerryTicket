import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const buildClient = (key) => createClient(env.supabaseUrl, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const supabase = buildClient(env.supabaseServerKey);
export const supabaseAdmin = supabase;
export const supabaseAuth = buildClient(env.supabaseAnonKey || env.supabaseServerKey);
