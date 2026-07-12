-- Fix RLS policies on queries table: role comparison must be case-insensitive
-- The memberships store 'Admin'/'Editor' but policies check for 'admin'/'editor'

DROP POLICY IF EXISTS "Admins and Editors can insert queries" ON queries;
DROP POLICY IF EXISTS "Admins and Editors can update queries" ON queries;
DROP POLICY IF EXISTS "Admins and Editors can delete queries" ON queries;

CREATE POLICY "Admins and Editors can insert queries" ON queries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = queries.company_id
        AND company_memberships.user_id = auth.uid()
        AND lower(company_memberships.role) IN ('admin', 'editor')
    )
  );

CREATE POLICY "Admins and Editors can update queries" ON queries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = queries.company_id
        AND company_memberships.user_id = auth.uid()
        AND lower(company_memberships.role) IN ('admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = queries.company_id
        AND company_memberships.user_id = auth.uid()
        AND lower(company_memberships.role) IN ('admin', 'editor')
    )
  );

CREATE POLICY "Admins and Editors can delete queries" ON queries
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = queries.company_id
        AND company_memberships.user_id = auth.uid()
        AND lower(company_memberships.role) IN ('admin', 'editor')
    )
  );
