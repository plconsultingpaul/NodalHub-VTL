/*
# Allow admins to read profiles of company members

Previously, profiles only had a "Users can read own profile" SELECT policy.
This meant that when an admin queried company_memberships joined with profiles,
the profile data for OTHER users came back as null (RLS blocked the join).

## Changes
- Added "Admins can read company member profiles" policy on profiles table
  that allows authenticated users to read profiles of anyone who shares a
  company with them (where the requesting user is an Admin).
*/

DROP POLICY IF EXISTS "Admins can read company member profiles" ON profiles;
CREATE POLICY "Admins can read company member profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm1
      JOIN company_memberships cm2 ON cm1.company_id = cm2.company_id
      WHERE cm1.user_id = auth.uid()
      AND cm1.role = 'Admin'
      AND cm2.user_id = profiles.id
    )
  );
