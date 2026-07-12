/*
# Fix is_company_admin function case sensitivity

The two-parameter version of `is_company_admin(uuid, uuid)` was checking
`role = 'admin'` (lowercase) but the database stores roles as `'Admin'`
(capitalized). This caused the "Admins can read company memberships" RLS
policy to never match, meaning admins could only see their own membership
row -- not other members of their company.

## Changes
- Updated `is_company_admin(check_company_id uuid, check_user_id uuid)`
  to use `role = 'Admin'` (capitalized) matching the actual stored values.
*/

CREATE OR REPLACE FUNCTION is_company_admin(check_company_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.company_memberships
  WHERE company_id = check_company_id
  AND user_id = check_user_id
  AND role = 'Admin'
);
$$;
