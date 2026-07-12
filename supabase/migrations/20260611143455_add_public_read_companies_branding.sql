CREATE POLICY "Public can read company branding" ON companies
  FOR SELECT TO anon
  USING (true);