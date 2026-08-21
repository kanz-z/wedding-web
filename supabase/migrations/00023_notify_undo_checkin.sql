-- Migration: 00023_notify_undo_checkin
-- Memperbaiki notifikasi check-in agar membedakan antara check-in (delta > 0)
-- dan undo/koreksi (delta < 0). Sebelumnya trigger selalu menulis "melakukan
-- check-in (N orang)" bahkan untuk delta negatif, sehingga notifikasi undo
-- tampil salah sebagai check-in.
--
-- Catatan: undo check-in direpresentasikan sebagai baris INSERT dengan delta
-- negatif (ledger immutable), bukan UPDATE/DELETE.

CREATE OR REPLACE FUNCTION fn_notify_checkin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_name TEXT;
BEGIN
  SELECT name INTO v_name FROM reservations WHERE id = NEW.reservation_id;
  IF NEW.delta < 0 THEN
    INSERT INTO notifications (category, message, related_table, related_id)
    VALUES (
      'checkin',
      '<strong>' || COALESCE(v_name, 'Tamu') || '</strong> membatalkan check-in (' || NEW.delta || ' orang).',
      'guests',
      NEW.reservation_id
    );
  ELSE
    INSERT INTO notifications (category, message, related_table, related_id)
    VALUES (
      'checkin',
      '<strong>' || COALESCE(v_name, 'Tamu') || '</strong> melakukan check-in (' || NEW.delta || ' orang).',
      'guests',
      NEW.reservation_id
    );
  END IF;
  RETURN NEW;
END; $$;

-- Trigger tetap sama (AFTER INSERT). CREATE OR REPLACE FUNCTION di atas
-- langsung mengubah perilakunya; tidak perlu drop/recreate trigger.
