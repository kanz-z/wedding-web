-- Migration: Fix service_role permissions — restore default grants
-- Root cause: service_role kehilangan privilege pada schema public.
-- Semua Edge Function (rate-limit-guestbook, rate-limit-rsvp, check-in)
-- menggunakan service_role untuk bypass RLS — tanpa GRANT, operasi DB gagal 403.

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Default privileges untuk objek yang akan dibuat di masa depan
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;
