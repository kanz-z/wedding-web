-- Migration: fix DELETE cascade untuk reservation_audit_log + check_in_transactions
-- Masalah: deleteGuests() gagal FK constraint karena RLS memblokir DELETE di child tables secara silent

-- 1. reservation_audit_log — tambah FOR DELETE policy (GRANT DELETE sudah ada via 00013)
CREATE POLICY "auth_delete_audit_log" ON reservation_audit_log
  FOR DELETE TO authenticated
  USING (true);

-- 2. check_in_transactions — tambah GRANT DELETE + FOR DELETE policy
GRANT DELETE ON public.check_in_transactions TO authenticated;

CREATE POLICY "auth_delete_checkin" ON check_in_transactions
  FOR DELETE TO authenticated
  USING (true);
