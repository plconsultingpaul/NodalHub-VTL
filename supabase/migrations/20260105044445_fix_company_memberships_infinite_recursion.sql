/*
  # Fix Infinite Recursion in Company Memberships RLS

  ## Problem
  The current RLS policies for company_memberships cause infinite recursion because
  they query the same table they're protecting.

  ## Solution
  1. Drop all existing policies
  2. Create a helper function to check admin status without recursion
  3. Create new, simpler policies that don't cause recursion

  ## Changes
  - Drop all existing company_memberships policies
  - Create is_company_admin() function using SECURITY DEFINER
  - Create new non-recursive policies
*/

-- Drop all existing policies on company_memberships
DROP POLICY IF EXISTS "Users can read own memberships" ON company_memberships;
DROP POLICY IF EXISTS "Admins can read all memberships in their companies" ON company_memberships;
DROP POLICY IF EXISTS "Admins can insert memberships" ON company_memberships;
DROP POLICY IF EXISTS "Admins can update memberships in their companies" ON company_memberships;
DROP POLICY IF EXISTS "Admins can delete memberships in their companies" ON company_memberships;

-- Create a function to check if a user is an admin of a company
-- Using SECURITY DEFINER to bypass RLS when checking
CREATE OR REPLACE FUNCTION is_company_admin(company_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM company_memberships
    WHERE company_id = company_id_param
      AND user_id = user_id_param
      AND role = 'Admin'
      AND status = 'active'
  );
END;
$$;

-- Create new policies that don't cause recursion

-- Users can always read their own memberships
CREATE POLICY "Users can read own memberships"
  ON company_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all memberships in their companies (using helper function)
CREATE POLICY "Admins can read company memberships"
  ON company_memberships
  FOR SELECT
  TO authenticated
  USING (is_company_admin(company_id, auth.uid()));

-- Admins can insert new memberships
CREATE POLICY "Admins can insert memberships"
  ON company_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_company_admin(company_id, auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM company_memberships WHERE company_id = company_memberships.company_id
    )
  );

-- Admins can update memberships in their companies
CREATE POLICY "Admins can update memberships"
  ON company_memberships
  FOR UPDATE
  TO authenticated
  USING (is_company_admin(company_id, auth.uid()))
  WITH CHECK (is_company_admin(company_id, auth.uid()));

-- Admins can delete memberships in their companies
CREATE POLICY "Admins can delete memberships"
  ON company_memberships
  FOR DELETE
  TO authenticated
  USING (is_company_admin(company_id, auth.uid()));
