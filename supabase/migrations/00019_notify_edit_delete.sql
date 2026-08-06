-- Migration: 00019 — Notifikasi untuk UPDATE dan DELETE di reservations
-- Menambah trigger untuk mengisi tabel notifications saat
-- tamu diperbarui (selain approval_status) atau dihapus.

-- ============================================================
-- 1. Notifikasi UPDATE reservasi (perubahan non-approval)
-- ============================================================
-- fn_notify_approval_change (dari 00012) hanya menangani
-- perubahan approval_status. Trigger ini menangani perubahan
-- data signifikan: name, guest_count, kelompok.

CREATE OR REPLACE FUNCTION fn_notify_reservation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF (NEW.name <> OLD.name)
     OR (NEW.guest_count IS DISTINCT FROM OLD.guest_count)
     OR (NEW.kelompok IS DISTINCT FROM OLD.kelompok)
  THEN
    INSERT INTO notifications (category, message, related_table, related_id)
    VALUES (
      'new_reservation',
      '<strong>' || NEW.name || '</strong> — data tamu diperbarui.',
      'guests',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_reservation_update
  AFTER UPDATE ON reservations
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION fn_notify_reservation_update();

-- ============================================================
-- 2. Notifikasi DELETE reservasi
-- ============================================================

CREATE OR REPLACE FUNCTION fn_notify_reservation_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO notifications (category, message, related_table, related_id)
  VALUES (
    'anomaly',
    '<strong>' || OLD.name || '</strong> telah dihapus dari daftar tamu.',
    'guests',
    OLD.id
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_notify_reservation_delete
  AFTER DELETE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_reservation_delete();
