-- Migration: Fase 2 — Database & RLS
-- Mencakup task 2.1 (tabel), 2.2 (constraints), 2.3 (index), 2.4 (RLS), 2.5 (function)

-- ============================================================
-- 2.1: Tabel
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
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
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

-- ============================================================
-- 2.2: Constraints
-- ============================================================

ALTER TABLE reservations ADD CONSTRAINT uq_reservations_slug    UNIQUE (slug);
ALTER TABLE reservations ADD CONSTRAINT uq_reservations_qr_token UNIQUE (qr_token);
ALTER TABLE reservations ADD CONSTRAINT ck_guest_count_positive CHECK (guest_count >= 1);

-- ============================================================
-- 2.3: Index
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_reservations_slug            ON reservations (slug);
CREATE INDEX IF NOT EXISTS idx_reservations_qr_token        ON reservations (qr_token);
CREATE INDEX IF NOT EXISTS idx_reservations_approval_status ON reservations (approval_status);
CREATE INDEX IF NOT EXISTS idx_reservations_name            ON reservations (name);
CREATE INDEX IF NOT EXISTS idx_reservations_kelompok        ON reservations (kelompok);
CREATE INDEX IF NOT EXISTS idx_reservations_kategori        ON reservations (kategori);

CREATE INDEX IF NOT EXISTS idx_checkin_reservation_id ON check_in_transactions (reservation_id);
CREATE INDEX IF NOT EXISTS idx_checkin_created_at     ON check_in_transactions (created_at);

CREATE INDEX IF NOT EXISTS idx_guestbook_approved_created ON guestbook (is_approved, created_at);

-- ============================================================
-- 2.4: RLS Policies
-- ============================================================

ALTER TABLE reservations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE guestbook             ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits_rsvp      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits_guestbook ENABLE ROW LEVEL SECURITY;

-- reservations: anon SELECT via qr_token di JWT, authenticated full access
CREATE POLICY "anon_select_by_qr_token" ON reservations
  FOR SELECT TO anon
  USING (qr_token = COALESCE(current_setting('request.jwt.claims', true)::json->>'qr_token', ''));

CREATE POLICY "auth_all_reservations" ON reservations
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- check_in_transactions: authenticated SELECT+INSERT, no UPDATE/DELETE
CREATE POLICY "auth_select_checkin" ON check_in_transactions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert_checkin" ON check_in_transactions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- admin_users: authenticated read only
CREATE POLICY "auth_select_admin" ON admin_users
  FOR SELECT TO authenticated
  USING (true);

-- guestbook: anon SELECT where approved, authenticated full access
CREATE POLICY "anon_select_approved_guestbook" ON guestbook
  FOR SELECT TO anon
  USING (is_approved = true);

CREATE POLICY "auth_all_guestbook" ON guestbook
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- tambahan perbaikan
GRANT ALL ON public.reservations TO authenticated;
GRANT ALL ON public.guestbook TO authenticated;
GRANT SELECT ON public.admin_users TO authenticated;
GRANT SELECT ON public.guestbook TO anon;

-- rate_limits: no policy = fully denied for anon/authenticated (service_role only)

-- ============================================================
-- 2.5: DB Function — get_guest_by_slug
-- ============================================================

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
LANGUAGE plpgsql STABLE AS $$
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
