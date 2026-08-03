-- Migration: Hierarchical Roles — tambah role 'couple', bersihkan seed data fiktif
-- Menambah role 'couple' (mempelai) dengan akses view-only + guestbook
-- Menghapus akun fiktif @rezaashila.id (dari seed migration 00002 & 00011)
-- Mengubah lalaluqyana166@gmail.com menjadi role 'couple'

-- ============================================================
-- 1. Perluas CHECK constraint — tambah 'couple'
-- ============================================================
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('superadmin', 'admin', 'operator', 'couple'));

-- ============================================================
-- 2. Hapus akun fiktif — seed migration sebelumnya (00002, 00011)
-- ============================================================
DELETE FROM admin_users WHERE email LIKE '%@rezaashila.id';

-- ============================================================
-- 3. Upsert akun asli mempelai
-- ============================================================
INSERT INTO admin_users (id, email, role)
VALUES ('263ec6eb-c42c-400c-b109-d744c34da33b', 'lalaluqyana166@gmail.com', 'couple')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
