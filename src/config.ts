import type { EnvConfig } from './types/env';

const env = import.meta.env as Record<string, string | undefined>;

export const config: EnvConfig = {
  SUPABASE_URL: env.VITE_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY ?? '',
  SITE_URL: env.VITE_SITE_URL ?? '',
  RSVP_EDGE_FUNCTION: env.VITE_RSVP_EDGE_FUNCTION ?? '',
};
