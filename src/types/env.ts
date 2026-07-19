/** Interface untuk environment variables dari Vite (import.meta.env) */
export interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SITE_URL: string;
  RSVP_EDGE_FUNCTION: string;
  GUESTBOOK_EDGE_FUNCTION: string;
  CHECK_IN_EDGE_FUNCTION: string;
}
