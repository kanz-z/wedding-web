-- Migration: Fix get_guest_by_slug — ubah ke SECURITY DEFINER
-- Root cause: fungsi berjalan sebagai SECURITY INVOKER (default),
-- sehingga query internal SELECT FROM reservations kena RLS policy
-- `anon_select_by_qr_token` yang mensyaratkan JWT claim qr_token.
-- Pengunjung publik tidak punya JWT claim → query selalu kosong →
-- "_fetchError: Undangan tidak ditemukan".

ALTER FUNCTION get_guest_by_slug(slug_param TEXT) SECURITY DEFINER;

-- Amankan search_path untuk mencegah privilege escalation
ALTER FUNCTION get_guest_by_slug(slug_param TEXT) SET search_path = 'public';
