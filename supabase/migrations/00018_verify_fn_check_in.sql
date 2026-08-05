-- Migration: Verifikasi fn_check_in function tersedia dan bisa diinvoke
-- Referensi: 00003_checkin_function.sql (fn_check_in definition)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_check_in'
  ) THEN
    RAISE EXCEPTION 'fn_check_in tidak ditemukan di schema public — jalankan migration 00003_checkin_function terlebih dahulu';
  END IF;
END;
$$;

-- Re-grant execute untuk authenticated
-- Signature: fn_check_in(p_reservation_id UUID, p_admin_id UUID, p_delta INTEGER, p_method TEXT, p_is_override BOOLEAN, p_notes TEXT)
GRANT EXECUTE ON FUNCTION public.fn_check_in(UUID, UUID, INTEGER, TEXT, BOOLEAN, TEXT) TO authenticated;
