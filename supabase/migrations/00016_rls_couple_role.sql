-- Migration: RLS Policies untuk role 'couple'
-- Membatasi akses check-in & guestbook untuk role mempelai
-- Policy SELECT/INSERT/UPDATE/DELETE reservations sudah aman — couple otomatis tertolak
-- karena policy eksplisit menyebut IN ('superadmin', 'admin', 'operator')

-- ============================================================
-- 1. check_in_transactions — couple TIDAK bisa INSERT
-- ============================================================
DROP POLICY IF EXISTS "auth_insert_checkin" ON check_in_transactions;
CREATE POLICY "auth_insert_checkin" ON check_in_transactions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin', 'operator')
  ));

-- check_in_transactions — couple juga tidak bisa DELETE
DROP POLICY IF EXISTS "auth_delete_checkin" ON check_in_transactions;
CREATE POLICY "auth_delete_checkin" ON check_in_transactions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin', 'operator')
  ));

-- ============================================================
-- 2. guestbook — couple SELECT & INSERT saja, tidak UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "auth_all_guestbook" ON guestbook;

CREATE POLICY "auth_select_guestbook" ON guestbook
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert_guestbook" ON guestbook
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_guestbook" ON guestbook
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin', 'operator')
  ))
  WITH CHECK (true);

CREATE POLICY "auth_delete_guestbook" ON guestbook
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin', 'operator')
  ));

-- ============================================================
-- 3. reservation_audit_log — couple tidak bisa DELETE
-- ============================================================
DROP POLICY IF EXISTS "auth_delete_audit_log" ON reservation_audit_log;
CREATE POLICY "auth_delete_audit_log" ON reservation_audit_log
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin', 'operator')
  ));
