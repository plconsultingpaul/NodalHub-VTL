/*
# Fix API Specs RLS Policy Role Case Mismatch

## Problem
The INSERT/UPDATE/DELETE policies on `api_specs`, `api_spec_endpoints`, and `api_endpoint_fields`
check for lowercase role values ('admin', 'editor') but the actual data in `company_memberships`
uses capitalized values ('Admin', 'User'). This causes "new row violates row-level security policy"
errors when admins try to upload API specifications.

## Changes
- Drop and recreate INSERT, UPDATE, DELETE policies on `api_specs` with correct case ('Admin')
- Drop and recreate INSERT, DELETE policies on `api_spec_endpoints` with correct case ('Admin')
- Drop and recreate INSERT, DELETE policies on `api_endpoint_fields` with correct case ('Admin')

## Security
- Policies now correctly match the 'Admin' role stored in company_memberships
- No change in access intent — only Admins can insert/update/delete specs
*/

-- Fix api_specs policies
DROP POLICY IF EXISTS "Admins and Editors can insert api_specs" ON api_specs;
CREATE POLICY "Admins and Editors can insert api_specs"
  ON api_specs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can update api_specs" ON api_specs;
CREATE POLICY "Admins and Editors can update api_specs"
  ON api_specs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can delete api_specs" ON api_specs;
CREATE POLICY "Admins and Editors can delete api_specs"
  ON api_specs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

-- Fix api_spec_endpoints policies
DROP POLICY IF EXISTS "Admins and Editors can insert api_spec_endpoints" ON api_spec_endpoints;
CREATE POLICY "Admins and Editors can insert api_spec_endpoints"
  ON api_spec_endpoints FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM api_specs
      JOIN company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_specs.id = api_spec_endpoints.api_spec_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can delete api_spec_endpoints" ON api_spec_endpoints;
CREATE POLICY "Admins and Editors can delete api_spec_endpoints"
  ON api_spec_endpoints FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_specs
      JOIN company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_specs.id = api_spec_endpoints.api_spec_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

-- Fix api_endpoint_fields policies
DROP POLICY IF EXISTS "Admins and Editors can insert api_endpoint_fields" ON api_endpoint_fields;
CREATE POLICY "Admins and Editors can insert api_endpoint_fields"
  ON api_endpoint_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM api_spec_endpoints
      JOIN api_specs ON api_specs.id = api_spec_endpoints.api_spec_id
      JOIN company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_spec_endpoints.id = api_endpoint_fields.api_spec_endpoint_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

DROP POLICY IF EXISTS "Admins and Editors can delete api_endpoint_fields" ON api_endpoint_fields;
CREATE POLICY "Admins and Editors can delete api_endpoint_fields"
  ON api_endpoint_fields FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_spec_endpoints
      JOIN api_specs ON api_specs.id = api_spec_endpoints.api_spec_id
      JOIN company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_spec_endpoints.id = api_endpoint_fields.api_spec_endpoint_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );