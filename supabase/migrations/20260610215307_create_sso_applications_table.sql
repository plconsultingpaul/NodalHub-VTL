CREATE TABLE sso_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  app_identifier text NOT NULL,
  icon_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sso_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_sso_applications" ON sso_applications FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = sso_applications.company_id
        AND company_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_sso_applications" ON sso_applications FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = sso_applications.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "update_sso_applications" ON sso_applications FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = sso_applications.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = sso_applications.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "delete_sso_applications" ON sso_applications FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = sso_applications.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

CREATE INDEX idx_sso_applications_company_id ON sso_applications(company_id);
