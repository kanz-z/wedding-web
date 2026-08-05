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
GRANT EXECUTE ON FUNCTION public.fn_check_in(TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, INTEGER) TO authenticated;
