-- Migration: 00012_notifications — Tabel notifikasi dengan auto-create trigger
-- Mendukung 7 kategori: anomaly, rsvp_pending, new_guestbook, new_reservation, checkin, rsvp_approved, rsvp_rejected
-- Anomali di-insert dari frontend (flag adalah computed field client-side oleh detectAnomaly())

-- ============================================================
-- 1. TABEL
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL CHECK (category IN (
                  'anomaly', 'rsvp_pending', 'new_guestbook',
                  'new_reservation', 'checkin', 'rsvp_approved', 'rsvp_rejected'
                )),
  message       TEXT NOT NULL,
  related_table TEXT,
  related_id    UUID,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_category   ON notifications (category);

-- ============================================================
-- 3. RLS ENABLE
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- Admin: SELECT semua notifikasi
CREATE POLICY "auth_select_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()
  ));

-- Admin: UPDATE is_read (mark as read)
CREATE POLICY "auth_update_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()
  ))
  WITH CHECK (true);

-- Tidak ada INSERT policy — INSERT via trigger DB dan service_role.
-- Tidak ada DELETE policy — notifikasi tidak dihapus manual.

-- ============================================================
-- 5. GRANTS
-- ============================================================

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- ============================================================
-- 6. TRIGGER FUNCTIONS
-- ============================================================

-- 6.1 Guestbook baru
CREATE OR REPLACE FUNCTION fn_notify_guestbook_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO notifications (category, message, related_table, related_id)
  VALUES (
    'new_guestbook',
    '<strong>' || NEW.name || '</strong> mengirim ucapan baru di guestbook.',
    'guestbook',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_guestbook_insert
  AFTER INSERT ON guestbook
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_guestbook_insert();

-- 6.2 Perubahan approval status RSVP (pending / approved / rejected)
CREATE OR REPLACE FUNCTION fn_notify_approval_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- RSVP pending (baru isi RSVP, atau di-reset ke pending)
  IF NEW.approval_status = 'pending' AND (OLD.approval_status IS NULL OR OLD.approval_status <> 'pending') THEN
    INSERT INTO notifications (category, message, related_table, related_id)
    VALUES (
      'rsvp_pending',
      '<strong>' || NEW.name || '</strong> mengisi RSVP — menunggu persetujuan.',
      'guests',
      NEW.id
    );
  END IF;

  -- RSVP approved
  IF NEW.approval_status = 'approved' AND OLD.approval_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO notifications (category, message, related_table, related_id)
    VALUES (
      'rsvp_approved',
      '<strong>' || NEW.name || '</strong> — RSVP telah disetujui.',
      'guests',
      NEW.id
    );
  END IF;

  -- RSVP rejected
  IF NEW.approval_status = 'rejected' AND OLD.approval_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO notifications (category, message, related_table, related_id)
    VALUES (
      'rsvp_rejected',
      '<strong>' || NEW.name || '</strong> — RSVP ditolak.',
      'guests',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_approval_change
  AFTER UPDATE OF approval_status ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_approval_change();

-- 6.3 Reservasi baru
CREATE OR REPLACE FUNCTION fn_notify_reservation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO notifications (category, message, related_table, related_id)
  VALUES (
    'new_reservation',
    '<strong>' || NEW.name || '</strong> ditambahkan sebagai tamu baru.',
    'guests',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_reservation_insert
  AFTER INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_reservation_insert();

-- 6.4 Check-in
CREATE OR REPLACE FUNCTION fn_notify_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT name INTO v_name FROM reservations WHERE id = NEW.reservation_id;
  INSERT INTO notifications (category, message, related_table, related_id)
  VALUES (
    'checkin',
    '<strong>' || COALESCE(v_name, 'Tamu') || '</strong> melakukan check-in (' || NEW.delta || ' orang).',
    'guests',
    NEW.reservation_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_checkin
  AFTER INSERT ON check_in_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_checkin();
