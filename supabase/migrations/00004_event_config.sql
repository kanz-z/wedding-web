-- Migration: GAP-001 + GAP-004 — event_config + approval mode + event status
-- Tabel event_config untuk konfigurasi runtime (approval mode, event status, dll.)

CREATE TABLE IF NOT EXISTS event_config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_config ENABLE ROW LEVEL SECURITY;

-- Admin authenticated bisa baca semua config
CREATE POLICY "auth_select_event_config" ON event_config
  FOR SELECT TO authenticated
  USING (true);

-- Hanya superadmin yang bisa mengubah config
CREATE POLICY "auth_admin_update_event_config" ON event_config
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt()->>'email'
      AND admin_users.role = 'superadmin'
  ))
  WITH CHECK (true);

CREATE POLICY "auth_admin_insert_event_config" ON event_config
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt()->>'email'
      AND admin_users.role = 'superadmin'
  ));

GRANT SELECT ON public.event_config TO authenticated;
GRANT INSERT, UPDATE ON public.event_config TO authenticated;

-- Seed default config
INSERT INTO event_config (key, value) VALUES
  ('approval_mode', '{"type": "auto","threshold_non_keluarga": 2}'::jsonb),
  ('event_status', '"online"'::jsonb)
ON CONFLICT (key) DO NOTHING;
