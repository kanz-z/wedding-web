-- Migration: Konsolidasi FIX — state akhir semua migrasi
-- Menggabungkan 00001 s/d 00010 tanpa kehilangan satu baris pun
-- Fix critical/high diterapkan inline (C1, C2, H3, H4, H5)
-- 00006 (regresi) di-skip karena dibatalkan 00010

-- ============================================================
-- 1. TABEL (dari 00001, 00004, 00005)
-- ============================================================

CREATE TABLE IF NOT EXISTS reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL,
  qr_token        TEXT NOT NULL,
  name            TEXT NOT NULL,
  guest_count     INTEGER NOT NULL,
  kelompok        TEXT,
  kategori        TEXT NOT NULL DEFAULT 'bukan' CHECK (kategori IN ('keluarga', 'bukan')),
  nomor_wa        TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'cancelled')),
  edited_status   TEXT CHECK (edited_status IN ('rsvp', 'admin')),
  notes           TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('superadmin', 'admin', 'operator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS check_in_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  admin_id       UUID NOT NULL REFERENCES admin_users(id),
  delta          INTEGER NOT NULL,
  method         TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('qr', 'manual')),
  is_override    BOOLEAN NOT NULL DEFAULT false,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guestbook (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  message        TEXT NOT NULL,
  is_approved    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limits_rsvp (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limits_guestbook (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- event_config (dari 00004)
CREATE TABLE IF NOT EXISTS event_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notifications (dari 00012)
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

-- reservation_audit_log (dari 00005)
CREATE TABLE IF NOT EXISTS reservation_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  admin_id       UUID REFERENCES admin_users(id),
  old_values     JSONB,
  new_values     JSONB,
  changed_by     TEXT NOT NULL DEFAULT 'system',
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. CONSTRAINTS (dari 00001 + 00005)
-- ============================================================

ALTER TABLE reservations ADD CONSTRAINT IF NOT EXISTS uq_reservations_slug    UNIQUE (slug);
ALTER TABLE reservations ADD CONSTRAINT IF NOT EXISTS uq_reservations_qr_token UNIQUE (qr_token);
ALTER TABLE reservations ADD CONSTRAINT IF NOT EXISTS ck_guest_count_positive  CHECK (guest_count >= 1);

-- GAP-009: approval_status sudah inline di CREATE TABLE (termasuk 'cancelled')
-- Tidak perlu ALTER terpisah karena tabel dibuat baru

-- ============================================================
-- 3. INDEXES (dari 00001 + 00005, fix H3, H4, H5)
-- ============================================================

-- reservations: HANYA non-duplikat index (UNIQUE constraint sudah punya B-tree sendiri)
-- H3 FIX: idx_reservations_slug & idx_reservations_qr_token DIHAPUS — redundant dengan UNIQUE
CREATE INDEX IF NOT EXISTS idx_reservations_approval_status ON reservations (approval_status);
CREATE INDEX IF NOT EXISTS idx_reservations_name            ON reservations (name);
CREATE INDEX IF NOT EXISTS idx_reservations_kelompok        ON reservations (kelompok);
CREATE INDEX IF NOT EXISTS idx_reservations_kategori        ON reservations (kategori);

-- check_in_transactions
CREATE INDEX IF NOT EXISTS idx_checkin_reservation_id ON check_in_transactions (reservation_id);
CREATE INDEX IF NOT EXISTS idx_checkin_created_at     ON check_in_transactions (created_at);
-- H4 FIX: FK admin_id tanpa index → tambah
CREATE INDEX IF NOT EXISTS idx_checkin_admin_id       ON check_in_transactions (admin_id);

-- guestbook
CREATE INDEX IF NOT EXISTS idx_guestbook_approved_created ON guestbook (is_approved, created_at);
-- H4 FIX: FK reservation_id tanpa index → tambah
CREATE INDEX IF NOT EXISTS idx_guestbook_reservation_id   ON guestbook (reservation_id);

-- reservation_audit_log (dari 00005)
CREATE INDEX IF NOT EXISTS idx_audit_log_reservation_id ON reservation_audit_log (reservation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at     ON reservation_audit_log (created_at);

-- notifications (dari 00012)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_category   ON notifications (category);

-- H5 FIX: rate_limits tumbuh tanpa batas — index untuk cleanup query
CREATE INDEX IF NOT EXISTS idx_rate_limits_rsvp_created_at      ON rate_limits_rsvp (created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_guestbook_created_at ON rate_limits_guestbook (created_at);

-- ============================================================
-- 4. RLS ENABLE (dari 00001, 00004, 00005)
-- ============================================================

ALTER TABLE reservations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE guestbook             ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits_rsvp      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits_guestbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES (state akhir dari 00001 + 00004 + 00005 + 00008 + 00010)
-- ============================================================

-- reservations: anon SELECT via qr_token (00001)
CREATE POLICY "anon_select_by_qr_token" ON reservations
  FOR SELECT TO anon
  USING (qr_token = COALESCE(current_setting('request.jwt.claims', true)::json->>'qr_token', ''));

-- reservations: role-based SELECT/INSERT/UPDATE/DELETE (00010 — final)
CREATE POLICY "auth_select_reservations" ON reservations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "auth_insert_reservations" ON reservations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin', 'operator')
  ));

CREATE POLICY "auth_update_reservations" ON reservations
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin')
  ))
  WITH CHECK (true);

CREATE POLICY "auth_delete_reservations" ON reservations
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('superadmin', 'admin')
  ));

-- check_in_transactions (00001)
CREATE POLICY "auth_select_checkin" ON check_in_transactions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert_checkin" ON check_in_transactions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- admin_users: authenticated read only (00001)
CREATE POLICY "auth_select_admin" ON admin_users
  FOR SELECT TO authenticated
  USING (true);

-- guestbook (00001)
CREATE POLICY "anon_select_approved_guestbook" ON guestbook
  FOR SELECT TO anon
  USING (is_approved = true);

CREATE POLICY "auth_all_guestbook" ON guestbook
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- event_config (00004 + 00008, C2 FIX: email → auth.uid())
CREATE POLICY "anon_select_event_config" ON event_config
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "auth_select_event_config" ON event_config
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_admin_update_event_config" ON event_config
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role = 'superadmin'
  ))
  WITH CHECK (true);

CREATE POLICY "auth_admin_insert_event_config" ON event_config
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
      AND admin_users.role = 'superadmin'
  ));

-- reservation_audit_log (00005)
CREATE POLICY "auth_select_audit_log" ON reservation_audit_log
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert_audit_log" ON reservation_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- notifications (dari 00012)
CREATE POLICY "auth_select_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "auth_update_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()
  ))
  WITH CHECK (true);

-- rate_limits: no policy → hanya service_role yang bisa akses

-- ============================================================
-- 6. FUNCTIONS (dari 00001 + 00003 + 00005 + 00009)
-- ============================================================

-- get_guest_by_slug (00001 body, 00009 SECURITY DEFINER + search_path)
CREATE OR REPLACE FUNCTION get_guest_by_slug(slug_param TEXT)
RETURNS TABLE (
  id                UUID,
  slug              TEXT,
  qr_token          TEXT,
  name              TEXT,
  guest_count       INTEGER,
  kelompok          TEXT,
  kategori          TEXT,
  nomor_wa          TEXT,
  approval_status   TEXT,
  edited_status     TEXT,
  notes             TEXT,
  version           INTEGER,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  approved_at       TIMESTAMPTZ,
  rejected_at       TIMESTAMPTZ,
  checked_in        BIGINT,
  attendance_status TEXT
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _checked_in  BIGINT;
  _guest_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(cit.delta), 0)
    INTO _checked_in
    FROM check_in_transactions cit
    JOIN reservations r ON r.id = cit.reservation_id
   WHERE r.slug = slug_param;

  SELECT r.guest_count INTO _guest_count
    FROM reservations r
   WHERE r.slug = slug_param;

  RETURN QUERY
    SELECT
      r.id, r.slug, r.qr_token, r.name, r.guest_count,
      r.kelompok, r.kategori, r.nomor_wa,
      r.approval_status, r.edited_status, r.notes, r.version,
      r.created_at, r.updated_at, r.approved_at, r.rejected_at,
      _checked_in AS checked_in,
      CASE
        WHEN _checked_in >= _guest_count THEN 'Complete'
        WHEN _checked_in > 0               THEN 'Partial'
        ELSE                                    'Not Started'
      END AS attendance_status
    FROM reservations r
    WHERE r.slug = slug_param;
END;
$$;

-- fn_check_in (00003 — tidak ada perubahan)
CREATE OR REPLACE FUNCTION fn_check_in(
  p_reservation_id UUID,
  p_admin_id       UUID,
  p_delta          INTEGER,
  p_method         TEXT,
  p_is_override    BOOLEAN DEFAULT false,
  p_notes          TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation  reservations%ROWTYPE;
  v_current_sum  INTEGER;
  v_new_total    INTEGER;
  v_tx_id        UUID;
BEGIN
  -- Validate input
  IF p_method NOT IN ('qr', 'manual') THEN
    RETURN jsonb_build_object('error', 'Method harus qr atau manual');
  END IF;

  -- Lock the reservation row (prevents race condition)
  SELECT * INTO v_reservation
    FROM reservations
   WHERE id = p_reservation_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Reservasi tidak ditemukan');
  END IF;

  -- Calculate current total
  SELECT COALESCE(SUM(delta), 0) INTO v_current_sum
    FROM check_in_transactions
   WHERE reservation_id = p_reservation_id;

  v_new_total := v_current_sum + p_delta;

  -- Validation 1: total tidak boleh negatif
  IF v_new_total < 0 THEN
    RETURN jsonb_build_object(
      'error', 'Jumlah check-in tidak valid: total menjadi ' || v_new_total,
      'current_checked_in', v_current_sum,
      'guest_count', v_reservation.guest_count
    );
  END IF;

  -- Validation 2: tidak boleh melebihi guest_count (kecuali override)
  IF v_new_total > v_reservation.guest_count AND NOT p_is_override THEN
    RETURN jsonb_build_object(
      'error', 'Jumlah melebihi kuota (' || v_current_sum || '/' || v_reservation.guest_count || '). Gunakan override.',
      'needs_override', true,
      'current_checked_in', v_current_sum,
      'guest_count', v_reservation.guest_count
    );
  END IF;

  -- Validation 3: override wajib notes
  IF p_is_override AND (p_notes IS NULL OR TRIM(p_notes) = '') THEN
    RETURN jsonb_build_object('error', 'Notes wajib diisi untuk override kuota');
  END IF;

  -- INSERT the transaction (immutable ledger)
  INSERT INTO check_in_transactions (
    reservation_id, admin_id, delta, method, is_override, notes
  ) VALUES (
    p_reservation_id, p_admin_id, p_delta, p_method, p_is_override, p_notes
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'reservation_id', p_reservation_id,
    'guest_name', v_reservation.name,
    'previous_checked_in', v_current_sum,
    'new_checked_in', v_new_total,
    'guest_count', v_reservation.guest_count,
    'delta', p_delta,
    'is_override', p_is_override
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- fn_audit_reservation_update (00005, C1 FIX: + SET search_path = 'public')
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
      ELSE 'system'
    END
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- 7. TRIGGERS (dari 00005)
-- ============================================================

DROP TRIGGER IF EXISTS trg_audit_reservation_update ON reservations;
CREATE TRIGGER trg_audit_reservation_update
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_reservation_update();

-- Notification triggers (dari 00012)
CREATE OR REPLACE FUNCTION fn_notify_guestbook_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO notifications (category, message, related_table, related_id)
  VALUES ('new_guestbook', '<strong>' || NEW.name || '</strong> mengirim ucapan baru di guestbook.', 'guestbook', NEW.id);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_guestbook_insert AFTER INSERT ON guestbook FOR EACH ROW EXECUTE FUNCTION fn_notify_guestbook_insert();

CREATE OR REPLACE FUNCTION fn_notify_approval_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.approval_status = 'pending' AND (OLD.approval_status IS NULL OR OLD.approval_status <> 'pending') THEN
    INSERT INTO notifications (category, message, related_table, related_id)
    VALUES ('rsvp_pending', '<strong>' || NEW.name || '</strong> mengisi RSVP — menunggu persetujuan.', 'guests', NEW.id);
  END IF;
  IF NEW.approval_status = 'approved' AND OLD.approval_status IS DISTINCT FROM 'approved' THEN
    INSERT INTO notifications (category, message, related_table, related_id)
    VALUES ('rsvp_approved', '<strong>' || NEW.name || '</strong> — RSVP telah disetujui.', 'guests', NEW.id);
  END IF;
  IF NEW.approval_status = 'rejected' AND OLD.approval_status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO notifications (category, message, related_table, related_id)
    VALUES ('rsvp_rejected', '<strong>' || NEW.name || '</strong> — RSVP ditolak.', 'guests', NEW.id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_approval_change AFTER UPDATE OF approval_status ON reservations FOR EACH ROW EXECUTE FUNCTION fn_notify_approval_change();

CREATE OR REPLACE FUNCTION fn_notify_reservation_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO notifications (category, message, related_table, related_id)
  VALUES ('new_reservation', '<strong>' || NEW.name || '</strong> ditambahkan sebagai tamu baru.', 'guests', NEW.id);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_reservation_insert AFTER INSERT ON reservations FOR EACH ROW EXECUTE FUNCTION fn_notify_reservation_insert();

CREATE OR REPLACE FUNCTION fn_notify_checkin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_name TEXT;
BEGIN
  SELECT name INTO v_name FROM reservations WHERE id = NEW.reservation_id;
  INSERT INTO notifications (category, message, related_table, related_id)
  VALUES ('checkin', '<strong>' || COALESCE(v_name, 'Tamu') || '</strong> melakukan check-in (' || NEW.delta || ' orang).', 'guests', NEW.reservation_id);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_checkin AFTER INSERT ON check_in_transactions FOR EACH ROW EXECUTE FUNCTION fn_notify_checkin();

-- ============================================================
-- 8. GRANTS (dari 00001 + 00003 + 00004 + 00005 + 00007 + 00008 + 00010)
-- ============================================================

-- Table grants untuk authenticated (00001 + 00010)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.guestbook TO authenticated;
GRANT SELECT ON public.admin_users TO authenticated;
GRANT SELECT, INSERT ON public.check_in_transactions TO authenticated;

-- event_config grants (00004 + 00008)
GRANT SELECT ON public.event_config TO authenticated;
GRANT INSERT, UPDATE ON public.event_config TO authenticated;
GRANT SELECT ON public.event_config TO anon;

-- reservation_audit_log grants (00005)
GRANT SELECT, INSERT ON public.reservation_audit_log TO authenticated;

-- notifications grants (00012)
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- anon grants (00001)
GRANT SELECT ON public.guestbook TO anon;

-- Function grants (00003 — tidak ada di migrasi asli, ditambahkan)
GRANT EXECUTE ON FUNCTION public.fn_check_in TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_in TO service_role;

-- service_role grants (00007)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Default privileges untuk objek masa depan (00007)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

-- ============================================================
-- 9. SEED DATA (dari 00002 + 00004)
-- ============================================================

-- Admin users (00002)
INSERT INTO admin_users (id, email, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'ashila@rezaashila.id', 'superadmin'),
  ('00000000-0000-0000-0000-000000000002', 'reza@rezaashila.id',    'superadmin'),
  ('00000000-0000-0000-0000-000000000003', 'panitia.checkin@rezaashila.id', 'operator')
ON CONFLICT (id) DO NOTHING;

-- Reservations (00002)
INSERT INTO reservations (id, slug, qr_token, name, guest_count, kelompok, kategori, nomor_wa, approval_status, edited_status, notes, created_at, updated_at, approved_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'aufa-kanz-a82js9',     'qr_token_aufa',     'Muhammad Aufa Kanz Anindito', 3, 'Keluarga Ashila',       'keluarga', '0812-3456-7890', 'approved', 'rsvp',  NULL,                                                                     '2026-07-01 00:00:00+00', '2026-07-01 00:00:00+00', '2026-07-01 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000002', 'siti-amara-x91qe2',    'qr_token_siti',     'Siti Amara',                   1, 'Teman Kuliah Ashila',   'bukan',    '0813-2211-0098', 'approved', NULL,     NULL,                                                                     '2026-07-02 00:00:00+00', '2026-07-02 00:00:00+00', '2026-07-02 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000003', 'damar-w-k77rtz',       'qr_token_damar',    'Damar Wicaksono',              4, 'Kolega Kantor Reza',    'bukan',    '0857-7723-1190', 'approved', NULL,     NULL,                                                                     '2026-07-03 00:00:00+00', '2026-07-03 00:00:00+00', '2026-07-03 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000004', 'keluarga-danurdoro',   'qr_token_danur',    'Keluarga Danurdoro',           6, 'Keluarga Ashila',       'keluarga', '0811-9090-1122', 'approved', NULL,     NULL,                                                                     '2026-07-04 00:00:00+00', '2026-07-04 00:00:00+00', '2026-07-04 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000005', 'farah-okta-p33lmv',    'qr_token_farah',    'Farah Oktaviani',              2, 'Teman Kantor Ashila',   'bukan',    '0822-4455-6677', 'approved', NULL,     'Tolong disediakan kursi roda untuk ibu saya',                             '2026-07-05 00:00:00+00', '2026-07-05 00:00:00+00', '2026-07-05 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000006', 'bagas-nararya',        'qr_token_bagas',    'Bagas Nararya',                2, 'Sahabat Reza',          'bukan',    '0856-1230-9988', 'approved', 'admin',   NULL,                                                                     '2026-07-06 00:00:00+00', '2026-07-06 00:00:00+00', '2026-07-06 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000007', 'keluarga-andriani',    'qr_token_andri',    'Keluarga Besar Andriani',      8, 'Keluarga Reza',         'keluarga', '0813-7788-2233', 'pending',  NULL,     'Butuh konfirmasi jumlah — mungkin ada tambahan',                           '2026-07-07 00:00:00+00', '2026-07-07 00:00:00+00', NULL),
  ('10000000-0000-0000-0000-000000000008', 'nadia-kirana',         'qr_token_nadia',    'Nadia Kirana',                 2, 'Teman SMA Ashila',      'bukan',    '0819-3344-5566', 'approved', 'rsvp',    NULL,                                                                     '2026-07-08 00:00:00+00', '2026-07-08 00:00:00+00', '2026-07-08 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000009', 'yusuf-maulana',        'qr_token_yusuf',    'Yusuf Maulana',                1, 'Kolega Kantor Reza',    'bukan',    '0878-2299-4411', 'approved', NULL,     NULL,                                                                     '2026-07-09 00:00:00+00', '2026-07-09 00:00:00+00', '2026-07-09 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000010', 'intan-permatasari',    'qr_token_intan',    'Intan Permatasari',            1, 'Teman Kuliah Ashila',   'bukan',    '0812-6677-8899', 'approved', NULL,     NULL,                                                                     '2026-07-10 00:00:00+00', '2026-07-10 00:00:00+00', '2026-07-10 00:00:00+00'),
  ('10000000-0000-0000-0000-000000000011', 'galih-prakoso',        'qr_token_galih',    'Galih Prakoso',                2, 'Sahabat Reza',          'bukan',    '0857-1122-3344', 'rejected', NULL,     'Tamu tidak bisa hadir — konfirmasi via WA',                               '2026-07-11 00:00:00+00', '2026-07-11 00:00:00+00', NULL),
  ('10000000-0000-0000-0000-000000000012', 'keluarga-hastono',     'qr_token_hastono',  'Keluarga Hastono',             5, 'Keluarga Reza',         'keluarga', '0811-2233-4455', 'approved', NULL,     'Hadir semua — titip salam untuk kedua mempelai',                           '2026-07-12 00:00:00+00', '2026-07-12 00:00:00+00', '2026-07-12 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Check-in transactions (00002)
INSERT INTO check_in_transactions (id, reservation_id, admin_id, delta, method, is_override, notes, created_at)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 3, 'qr',      false, NULL,                             '2026-08-22 10:14:00+00'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 3, 'qr',      false, NULL,                             '2026-08-22 10:30:00+00'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 4, 'manual',  true,  'Keluarga bawa tambahan 4 orang',  '2026-08-22 11:05:00+00'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 1, 'qr',      false, NULL,                             '2026-08-22 09:02:00+00'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 2, 'qr',      false, NULL,                             '2026-08-22 10:41:00+00')
ON CONFLICT (id) DO NOTHING;

-- Event config defaults (00004)
INSERT INTO event_config (key, value) VALUES
  ('approval_mode', '{"type": "auto","threshold_non_keluarga": 2}'::jsonb),
  ('event_status', '"online"'::jsonb)
ON CONFLICT (key) DO NOTHING;
