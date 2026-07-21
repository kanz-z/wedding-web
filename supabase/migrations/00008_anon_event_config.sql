CREATE POLICY "anon_select_event_config" ON event_config
  FOR SELECT TO anon
  USING (true);

GRANT SELECT ON public.event_config TO anon;