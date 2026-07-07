// src/main/supabase-client.js
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
export const supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
