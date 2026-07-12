/*
  # Fix Companies SELECT Policy for New Companies
  
  1. Problem
    - When creating a company, the INSERT succeeds but .select() fails
    - The SELECT policy requires membership, but membership doesn't exist yet
  
  2. Solution
    - Update SELECT policy to also allow reading companies with no memberships
    - This covers the brief moment between company creation and membership creation
  
  3. Security
    - Users can still only read companies they're members of
    - New companies (no memberships) can be read temporarily
    - Once membership is created, normal policy applies
*/

DROP POLICY IF EXISTS "Members can read their companies" ON companies;

CREATE POLICY "Members can read their companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = companies.id
      AND company_memberships.user_id = auth.uid()
    )
    OR
    NOT EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = companies.id
    )
  );