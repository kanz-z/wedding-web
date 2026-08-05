-- Migration: Couple Full Guest Access — izinkan role `couple` mengelola reservations penuh
-- Referensi: 00010_fix_rls_role_based.sql (RLS pattern), 00011_consolidated_fixes.sql (audit trigger)

-- ============================================================
-- 1. Perluas CHECK constraint edited_status — tambah 'couple'
-- ============================================================
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_edited_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_edited_status_check
  CHECK (edited_status IN ('rsvp', 'admin', 'couple'));

-- ============================================================
-- 2. INSERT — tambah 'couple' ke whitelist
-- ============================================================
DROP POLICY IF EXISTS "auth_insert_reservations" ON reservations;
CREATE POLICY "auth_insert_reservations" ON reservations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin', 'operator', 'couple')
  ));

-- ============================================================
-- 3. UPDATE — tambah 'couple' ke whitelist
-- ============================================================
DROP POLICY IF EXISTS "auth_update_reservations" ON reservations;
CREATE POLICY "auth_update_reservations" ON reservations
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin', 'couple')
  ))
  WITH CHECK (true);

-- ============================================================
-- 4. DELETE — tambah 'couple' ke whitelist
-- ============================================================
DROP POLICY IF EXISTS "auth_delete_reservations" ON reservations;
CREATE POLICY "auth_delete_reservations" ON reservations
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin', 'couple')
  ));

-- ============================================================
-- 5. Update audit trigger — kenali 'couple' sebagai changed_by
-- ============================================================
CREATE OR REPLACE FUNCTION fn_audit_reservation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO reservation_audit_log (reservation_id, admin_id, old_values, new_values, changed_by)
  VALUES (
    NEW.id,
    (SELECT id FROM admin_users WHERE email = COALESCE(auth.jwt()->>'email', 'system') LIMIT 1),
    jsonb_build_object(
      'name', OLD.name,
      'guest_count', OLD.guest_count::text,
      'kelompok', OLD.kelompok,
      'kategori', OLD.kategori,
      'nomor_wa', OLD.nomor_wa,
      'approval_status', OLD.approval_status,
      'notes', OLD.notes,
      'version', OLD.version::text
    ),
    jsonb_build_object(
      'name', NEW.name,
      'guest_count', NEW.guest_count::text,
      'kelompok', NEW.kelompok,
      'kategori', NEW.kategori,
      'nomor_wa', NEW.nomor_wa,
      'approval_status', NEW.approval_status,
      'notes', NEW.notes,
      'version', NEW.version::text
    ),
    CASE
      WHEN COALESCE(NEW.edited_status, 'system') = 'rsvp' THEN 'rsvp'
      WHEN COALESCE(NEW.edited_status, 'system') = 'admin' THEN 'admin'
      WHEN COALESCE(NEW.edited_status, 'system') = 'couple' THEN 'couple'
      ELSE 'system'
    END
  );
  RETURN NEW;
END;
$$;
