-- Migration: hapus kolom PII dari get_guest_by_slug
--
-- Masalah: fungsi SECURITY DEFINER ini sebelumnya mengembalikan seluruh kolom
-- reservations (termasuk `nomor_wa` dan `notes`), sehingga halaman tamu publik
-- bisa membaca nomor WhatsApp dan catatan pribadi tamu lain hanya dengan menebak slug.
--
-- Halaman tamu (slug-router.ts, rsvp.ts) hanya membutuhkan 4 kolom:
--   id, slug, qr_token, name.
-- Kolom lain (guest_count, kelompok, kategori, nomor_wa, approval_status,
-- edited_status, notes, version, timestamp, checked_in, attendance_status)
-- tidak dibaca oleh halaman publik, jadi dihapus dari hasil.

-- 42P13: CREATE OR REPLACE tidak bisa mengubah row type (jumlah kolom OUT),
-- jadi fungsi lama harus di-drop dulu sebelum didefinisikan ulang.
DROP FUNCTION IF EXISTS get_guest_by_slug(text);

CREATE OR REPLACE FUNCTION get_guest_by_slug(slug_param TEXT)
RETURNS TABLE (
  id       UUID,
  slug     TEXT,
  qr_token TEXT,
  name     TEXT
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT r.id, r.slug, r.qr_token, r.name
    FROM reservations r
   WHERE r.slug = slug_param;
$$;
