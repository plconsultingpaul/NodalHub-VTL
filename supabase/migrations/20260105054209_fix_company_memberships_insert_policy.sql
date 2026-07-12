/*
  # Fix Company Memberships Insert Policy
  
  1. Problem
    - The existing policy has a bug: it compares company_id to itself
    - This prevents users from creating memberships for new companies
  
  2. Solution
    - Fix the policy to properly check if the company has no existing memberships
    - Allow admins to insert memberships for their companies
    - Allow anyone to insert the first membership for a new company (creator becomes admin)
  
  3. Security
    - Admins can add members to their companies
    - Users can create the first membership for companies with no members
    - Users can only create memberships for themselves (not impersonate others)
*/

DROP POLICY IF EXISTS "Admins can insert memberships" ON company_memberships;

CREATE POLICY "Users can insert memberships"
  ON company_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      is_company_admin(company_id, auth.uid())
    )
    OR
    (
      user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM company_memberships cm
        WHERE cm.company_id = company_memberships.company_id
      )
    )
  );