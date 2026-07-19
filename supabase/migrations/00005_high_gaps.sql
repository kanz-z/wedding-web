-- Migration: HIGH gaps — GAP-009, GAP-010, GAP-015
-- GAP-009: approval_status 'cancelled'
-- GAP-010: reservation_audit_log table + trigger
-- GAP-015: RLS DELETE prevention on reservations

-- ============================================================
-- GAP-009: Tambah 'cancelled' ke CHECK constraint approval_status
-- ============================================================
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_approval_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- ============================================================
-- GAP-010: reservation_audit_log — melacak perubahan data reservasi
-- ============================================================
CREATE TABLE IF NOT EXISTS reservation_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  admin_id     UUID REFERENCES admin_users(id),
  old_values   JSONB,
  new_values   JSONB,
  changed_by   TEXT NOT NULL DEFAULT 'system', -- 'admin' | 'rsvp' | 'system'
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reservation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_audit_log" ON reservation_audit_log
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert_audit_log" ON reservation_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.reservation_audit_log TO authenticated;

CREATE INDEX IF NOT EXISTS idx_audit_log_reservation_id ON reservation_audit_log (reservation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON reservation_audit_log (created_at);

-- Trigger BEFORE UPDATE pada reservations untuk mencatat perubahan
CREATE OR REPLACE FUNCTION fn_audit_reservation_update()
RETURNS TRIGGER AS $$
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
      ELSE 'system'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_reservation_update ON reservations;
CREATE TRIGGER trg_audit_reservation_update
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_reservation_update();

-- ============================================================
-- GAP-015: Ganti FOR ALL menjadi SELECT+INSERT+UPDATE (tolak DELETE)
-- ============================================================
DROP POLICY IF EXISTS "auth_all_reservations" ON reservations;

CREATE POLICY "auth_select_insert_update_reservations" ON reservations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert_reservations" ON reservations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_reservations" ON reservations
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- No DELETE policy → DELETE ditolak oleh RLS
