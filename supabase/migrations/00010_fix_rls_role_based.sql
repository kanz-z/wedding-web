-- Migration: Fix RLS Policy Regression — role-based access control untuk reservations
-- Masalah: Migration 00006 membuat policy authenticated_full_access (FOR ALL) yang
-- mengembalikan DELETE permission yang sudah dihapus di 00005.
-- Solusi: Drop policy regresif, ganti dengan policy terpisah berbasis role admin_users.

-- 1. Hapus policy regresif dari 00006
DROP POLICY IF EXISTS "authenticated_full_access" ON reservations;

-- 2. Drop policy dari 00005 agar tidak konflik (akan dibuat ulang dengan role check)
DROP POLICY IF EXISTS "auth_select_insert_update_reservations" ON reservations;
DROP POLICY IF EXISTS "auth_insert_reservations" ON reservations;
DROP POLICY IF EXISTS "auth_update_reservations" ON reservations;

-- 3. SELECT — semua authenticated (admin_users) bisa melihat data tamu
CREATE POLICY "auth_select_reservations" ON reservations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()
  ));

-- 4. INSERT — operator, admin, superadmin bisa menambah tamu
CREATE POLICY "auth_insert_reservations" ON reservations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin', 'operator')
  ));

-- 5. UPDATE — hanya superadmin dan admin yang bisa mengubah data tamu
CREATE POLICY "auth_update_reservations" ON reservations
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin')
  ))
  WITH CHECK (true);

-- 6. DELETE — hanya superadmin dan admin yang bisa menghapus tamu
CREATE POLICY "auth_delete_reservations" ON reservations
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin')
  ));

-- 7. Pastikan GRANT tetap untuk authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
