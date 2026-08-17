-- supabase/migrations/00021_persistent_rsvp_status.sql

ALTER TABLE reservations
  ADD COLUMN rsvp TEXT CHECK (rsvp IN ('hadir', 'tidak'));  -- NULL = belum merespons

CREATE INDEX IF NOT EXISTS idx_reservations_rsvp ON reservations (rsvp);

-- Backfill 1: reservasi yang SAAT INI edited_status masih 'rsvp'
-- (belum tertimpa edit admin) → approval_status sekarang = jawaban RSVP asli.
UPDATE reservations
SET rsvp = CASE approval_status
             WHEN 'approved' THEN 'hadir'
             WHEN 'rejected' THEN 'tidak'
             ELSE NULL
           END
WHERE edited_status = 'rsvp';

-- Backfill 2: reservasi yang PERNAH RSVP tapi jejaknya sudah tertimpa
-- edit admin berikutnya → ambil dari reservation_audit_log (migrasi 00005),
-- entri 'rsvp' terakhir per reservasi.
WITH last_rsvp_audit AS (
  SELECT DISTINCT ON (reservation_id)
    reservation_id,
    new_values->>'approval_status' AS approval_status_at_rsvp
  FROM reservation_audit_log
  WHERE changed_by = 'rsvp'
  ORDER BY reservation_id, created_at DESC
)
UPDATE reservations r
SET rsvp = CASE a.approval_status_at_rsvp
             WHEN 'approved' THEN 'hadir'
             WHEN 'rejected' THEN 'tidak'
             ELSE NULL
           END
FROM last_rsvp_audit a
WHERE r.id = a.reservation_id AND r.rsvp IS NULL;

-- (Disarankan) Proteksi di level DB: kolom rsvp hanya boleh ditulis oleh
-- service_role (edge function RSVP), bukan role authenticated (dashboard admin).
-- Ini jaring pengaman kalau suatu saat kode dashboard tidak sengaja
-- menyertakan `rsvp` dalam payload update.
CREATE OR REPLACE FUNCTION fn_protect_rsvp_column()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NEW.rsvp IS DISTINCT FROM OLD.rsvp THEN
    NEW.rsvp := OLD.rsvp;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_rsvp ON reservations;
CREATE TRIGGER trg_protect_rsvp
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION fn_protect_rsvp_column();