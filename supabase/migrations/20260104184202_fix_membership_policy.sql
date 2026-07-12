/*
  # Fix Company Membership Insert Policy

  1. Changes
    - Simplify the membership insert policy to allow:
      - First member of a new company (no existing memberships)
      - Admins adding new members
    
  2. Security
    - Maintains secure access patterns
    - Allows proper onboarding flow
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Admins can insert memberships" ON company_memberships;

-- Create a simpler, working policy for inserts
CREATE POLICY "Users can create first membership or admins can add members"
  ON company_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if this is the user's own membership and no other memberships exist for this company
    (
      user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM company_memberships cm
        WHERE cm.company_id = company_memberships.company_id
      )
    )
    OR
    -- Allow if the current user is an admin of the company
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'Admin'
    )
  );