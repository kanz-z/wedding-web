// src/main/supabase-client.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

export const supabaseClient: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY
);
