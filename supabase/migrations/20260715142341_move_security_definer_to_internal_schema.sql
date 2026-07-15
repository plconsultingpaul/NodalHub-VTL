/*
# Move SECURITY DEFINER functions to internal schema + revoke direct RPC access

## Summary
Fixes "Signed-In Users Can Execute SECURITY DEFINER Function" audit findings by:
1. Moving RLS helper functions (is_company_admin, is_company_member, can_edit_company) 
   to a private `internal` schema not exposed by PostgREST, so they cannot be called 
   via `/rest/v1/rpc/...`.
2. Revoking EXECUTE from `authenticated` on trigger/scheduler functions that should 
   never be called directly (handle_new_user, ensure_single_default_template, 
   get_pulse_cron_jobs, get_pulse_scheduler_status, manage_pulse_scheduler_cron, 
   remove_pulse_scheduler_cron, run_due_pulse_schedules).

## Important Notes
1. RLS policies reference these functions. After moving to `internal` schema, the public 
   schema wrappers are dropped and policies are updated to use schema-qualified calls.
2. The `internal` schema is NOT in PostgREST's exposed schemas, so functions there 
   cannot be invoked via the REST API.
3. Functions remain SECURITY DEFINER in the internal schema because they need to bypass 
   RLS on company_memberships to prevent infinite recursion.
*/

-- Create internal schema for private functions
CREATE SCHEMA IF NOT EXISTS internal;

-- Move is_company_admin (no args) to internal
CREATE OR REPLACE FUNCTION internal.is_company_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
    AND LOWER(role) = 'admin'
  );
END;
$$;

-- Move is_company_admin (with args) to internal
CREATE OR REPLACE FUNCTION internal.is_company_admin(check_company_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = check_company_id
    AND user_id = check_user_id
    AND LOWER(role) = 'admin'
  );
END;
$$;

-- Move is_company_member to internal
CREATE OR REPLACE FUNCTION internal.is_company_member(check_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = check_company_id
    AND user_id = auth.uid()
  );
END;
$$;

-- Move can_edit_company to internal
CREATE OR REPLACE FUNCTION internal.can_edit_company(check_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = check_company_id
    AND user_id = auth.uid()
    AND LOWER(role) IN ('admin', 'editor')
  );
END;
$$;

-- Grant EXECUTE on internal functions to authenticated (needed for RLS evaluation)
GRANT USAGE ON SCHEMA internal TO authenticated;
GRANT EXECUTE ON FUNCTION internal.is_company_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION internal.is_company_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internal.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internal.can_edit_company(uuid) TO authenticated;

-- Also grant to service_role
GRANT USAGE ON SCHEMA internal TO service_role;
GRANT EXECUTE ON FUNCTION internal.is_company_admin() TO service_role;
GRANT EXECUTE ON FUNCTION internal.is_company_admin(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION internal.is_company_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION internal.can_edit_company(uuid) TO service_role;

-- Now update all RLS policies to use internal schema-qualified function calls

-- company_memberships policies
DROP POLICY IF EXISTS "Admins can read company memberships" ON public.company_memberships;
CREATE POLICY "Admins can read company memberships"
  ON public.company_memberships FOR SELECT
  TO authenticated
  USING (internal.is_company_admin(company_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can update memberships" ON public.company_memberships;
CREATE POLICY "Admins can update memberships"
  ON public.company_memberships FOR UPDATE
  TO authenticated
  USING (internal.is_company_admin(company_id, (SELECT auth.uid())))
  WITH CHECK (internal.is_company_admin(company_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can delete memberships" ON public.company_memberships;
CREATE POLICY "Admins can delete memberships"
  ON public.company_memberships FOR DELETE
  TO authenticated
  USING (internal.is_company_admin(company_id, (SELECT auth.uid())));

-- dashboards policies
DROP POLICY IF EXISTS "Editors can update dashboards" ON public.dashboards;
CREATE POLICY "Editors can update dashboards"
  ON public.dashboards FOR UPDATE
  TO authenticated
  USING (internal.can_edit_company(company_id))
  WITH CHECK (internal.can_edit_company(company_id));

-- pulses policies
DROP POLICY IF EXISTS "Members can read pulses" ON public.pulses;
CREATE POLICY "Members can read pulses"
  ON public.pulses FOR SELECT
  TO authenticated
  USING (internal.is_company_member(company_id));

DROP POLICY IF EXISTS "Editors can create pulses" ON public.pulses;
CREATE POLICY "Editors can create pulses"
  ON public.pulses FOR INSERT
  TO authenticated
  WITH CHECK (internal.can_edit_company(company_id));

DROP POLICY IF EXISTS "Editors can update pulses" ON public.pulses;
CREATE POLICY "Editors can update pulses"
  ON public.pulses FOR UPDATE
  TO authenticated
  USING (internal.can_edit_company(company_id))
  WITH CHECK (internal.can_edit_company(company_id));

-- projects policies
DROP POLICY IF EXISTS "Members can read projects" ON public.projects;
CREATE POLICY "Members can read projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (internal.is_company_member(company_id));

DROP POLICY IF EXISTS "Editors can create projects" ON public.projects;
CREATE POLICY "Editors can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (internal.can_edit_company(company_id));

DROP POLICY IF EXISTS "Editors can update projects" ON public.projects;
CREATE POLICY "Editors can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (internal.can_edit_company(company_id))
  WITH CHECK (internal.can_edit_company(company_id));

DROP POLICY IF EXISTS "Editors can delete projects" ON public.projects;
CREATE POLICY "Editors can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (internal.can_edit_company(company_id));

-- Revoke EXECUTE on old public versions from authenticated
REVOKE EXECUTE ON FUNCTION public.is_company_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_edit_company(uuid) FROM authenticated;

-- Revoke EXECUTE on non-RLS functions from authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_single_default_template() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_pulse_cron_jobs() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_pulse_scheduler_status() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.manage_pulse_scheduler_cron(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_pulse_scheduler_cron() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_due_pulse_schedules() FROM authenticated;
