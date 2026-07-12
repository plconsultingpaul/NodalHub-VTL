/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes
    - Add index on api_endpoints.created_by
    - Add index on dashboard_widgets.endpoint_id
    - Add index on dashboards.created_by
    - Add index on projects.created_by

  2. Optimize RLS Policies
    - Replace auth.uid() with (select auth.uid()) in all policies
    - This prevents re-evaluation of auth functions for each row

  3. Fix Function Search Paths
    - Set immutable search_path for all functions to prevent security issues
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_api_endpoints_created_by ON api_endpoints(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_endpoint_id ON dashboard_widgets(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Drop and recreate profiles policies with optimized auth.uid() calls
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- Drop and recreate companies policies with optimized auth.uid() calls
DROP POLICY IF EXISTS "Members can read their companies" ON companies;
DROP POLICY IF EXISTS "Admins can update their companies" ON companies;

CREATE POLICY "Members can read their companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = companies.id
      AND company_memberships.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can update their companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = companies.id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = companies.id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role = 'Admin'
    )
  );

-- Drop and recreate company_memberships policies with optimized auth.uid() calls
DROP POLICY IF EXISTS "Users can read own memberships" ON company_memberships;
DROP POLICY IF EXISTS "Admins can read all memberships in their companies" ON company_memberships;
DROP POLICY IF EXISTS "Admins can insert memberships" ON company_memberships;
DROP POLICY IF EXISTS "Admins can update memberships in their companies" ON company_memberships;
DROP POLICY IF EXISTS "Admins can delete memberships in their companies" ON company_memberships;

CREATE POLICY "Users can read own memberships"
  ON company_memberships FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Admins can read all memberships in their companies"
  ON company_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = (select auth.uid())
      AND cm.role = 'Admin'
    )
  );

CREATE POLICY "Admins can insert memberships"
  ON company_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = (select auth.uid())
      AND cm.role = 'Admin'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
    )
  );

CREATE POLICY "Admins can update memberships in their companies"
  ON company_memberships FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = (select auth.uid())
      AND cm.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = (select auth.uid())
      AND cm.role = 'Admin'
    )
  );

CREATE POLICY "Admins can delete memberships in their companies"
  ON company_memberships FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = (select auth.uid())
      AND cm.role = 'Admin'
    )
  );

-- Recreate functions with secure search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pending_company_id uuid;
  pending_role text;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  pending_company_id := (new.raw_user_meta_data->>'pending_company_id')::uuid;
  pending_role := new.raw_user_meta_data->>'pending_role';

  IF pending_company_id IS NOT NULL AND pending_role IS NOT NULL THEN
    INSERT INTO public.company_memberships (user_id, company_id, role)
    VALUES (new.id, pending_company_id, pending_role)
    ON CONFLICT (user_id, company_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION is_company_member(check_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_memberships
    WHERE company_id = check_company_id
    AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION can_edit_company(check_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_memberships
    WHERE company_id = check_company_id
    AND user_id = auth.uid()
    AND role IN ('Admin', 'Editor')
  );
END;
$$;