ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access"
ON reservations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);