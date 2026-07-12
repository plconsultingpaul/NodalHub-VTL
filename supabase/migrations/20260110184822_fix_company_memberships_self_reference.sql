/*
  # Fix Company Memberships Self-Reference Issue

  The previous migration created a self-referencing policy on company_memberships
  that causes infinite recursion when checking if a user is an admin.

  ## Solution
  1. Create a security definer function to check admin status without triggering RLS
  2. Update the "Admins can read company memberships" policy to use this function

  This avoids the circular dependency where RLS policies on company_memberships
  reference the same table.
*/

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS public.is_company_admin(uuid, uuid);

-- Create a security definer function to check if user is admin of a company
-- This bypasses RLS to avoid infinite recursion
CREATE FUNCTION public.is_company_admin(check_company_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = check_company_id
    AND user_id = check_user_id
    AND role = 'admin'
  );
$$;

-- Drop and recreate the problematic policy
DROP POLICY IF EXISTS "Admins can read company memberships" ON public.company_memberships;
CREATE POLICY "Admins can read company memberships"
  ON public.company_memberships
  FOR SELECT
  TO authenticated
  USING (
    public.is_company_admin(company_id, (select auth.uid()))
  );

-- Also fix the update policy that has the same issue
DROP POLICY IF EXISTS "Admins can update memberships" ON public.company_memberships;
CREATE POLICY "Admins can update memberships"
  ON public.company_memberships
  FOR UPDATE
  TO authenticated
  USING (
    public.is_company_admin(company_id, (select auth.uid()))
  )
  WITH CHECK (
    public.is_company_admin(company_id, (select auth.uid()))
  );

-- Fix the delete policy as well
DROP POLICY IF EXISTS "Admins can delete memberships" ON public.company_memberships;
CREATE POLICY "Admins can delete memberships"
  ON public.company_memberships
  FOR DELETE
  TO authenticated
  USING (
    public.is_company_admin(company_id, (select auth.uid()))
  );
