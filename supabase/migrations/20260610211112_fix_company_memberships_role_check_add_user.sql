/*
# Fix company_memberships role check constraint

The CHECK constraint only allowed 'Admin', 'Editor', 'Viewer' but the
application uses 'User' as a role. This caused invite inserts to fail
silently when creating non-admin members.

## Changes
- Drop and recreate the role check to include 'User'
*/

ALTER TABLE company_memberships DROP CONSTRAINT company_memberships_role_check;
ALTER TABLE company_memberships ADD CONSTRAINT company_memberships_role_check
  CHECK (role = ANY (ARRAY['Admin'::text, 'User'::text, 'Editor'::text, 'Viewer'::text]));
