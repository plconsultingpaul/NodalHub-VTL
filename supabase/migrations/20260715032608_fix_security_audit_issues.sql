/*
# Fix Security Audit Issues

## Summary
Addresses multiple security findings from the Supabase security audit.

## Changes

### 1. Fix mutable search_path on functions
- All public functions set to `search_path = ''` (immutable).
- Affected: is_company_admin (both overloads), manage_pulse_scheduler_cron,
  run_due_pulse_schedules, compute_next_cron_run, can_edit_company,
  ensure_single_default_template, get_pulse_cron_jobs, get_pulse_scheduler_status,
  handle_new_user, is_company_member, remove_pulse_scheduler_cron.

### 2. Fix always-true INSERT policy on companies
- Replaces unrestricted `WITH CHECK (true)` with authentication check.

### 3. Remove broad SELECT policy on company-logos storage bucket
- Public buckets serve objects by URL without needing a SELECT policy.
- Drops `public_read_logos` to prevent unauthorized file listing.

### 4. Revoke EXECUTE from anon/public on SECURITY DEFINER functions
- Revokes `anon` and `public` access from all public SECURITY DEFINER functions.
- Grants back to `authenticated` only for user-facing functions.
- Grants back to `service_role` only for scheduler/internal functions.

### Note on pg_net
- pg_net does not support SET SCHEMA. This is a Supabase platform-level limitation
  and cannot be moved from the public schema via a migration.

### Security Notes
1. Functions only used internally should not be callable via REST API by unauthenticated users.
2. The companies INSERT policy now requires authenticated users, matching the app's auth model.
3. Removing the storage SELECT policy does not affect public URL access to logos.
*/

-- 1. Fix mutable search_path on all public functions
ALTER FUNCTION public.is_company_admin() SET search_path = '';
ALTER FUNCTION public.is_company_admin(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.manage_pulse_scheduler_cron(text) SET search_path = '';
ALTER FUNCTION public.run_due_pulse_schedules() SET search_path = '';
ALTER FUNCTION public.compute_next_cron_run(text, text) SET search_path = '';
ALTER FUNCTION public.can_edit_company(uuid) SET search_path = '';
ALTER FUNCTION public.ensure_single_default_template() SET search_path = '';
ALTER FUNCTION public.get_pulse_cron_jobs() SET search_path = '';
ALTER FUNCTION public.get_pulse_scheduler_status() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.is_company_member(uuid) SET search_path = '';
ALTER FUNCTION public.remove_pulse_scheduler_cron() SET search_path = '';

-- 2. Fix always-true INSERT policy on companies
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Remove broad SELECT policy on company-logos storage bucket
DROP POLICY IF EXISTS "public_read_logos" ON storage.objects;

-- 4. Revoke EXECUTE from anon and public on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.can_edit_company(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ensure_single_default_template() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_pulse_cron_jobs() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_pulse_scheduler_status() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_company_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.manage_pulse_scheduler_cron(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.remove_pulse_scheduler_cron() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.run_due_pulse_schedules() FROM anon, public;

-- Grant EXECUTE to authenticated for user-facing helper functions
GRANT EXECUTE ON FUNCTION public.can_edit_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_single_default_template() TO authenticated;

-- Grant EXECUTE to service_role for scheduler/internal functions
GRANT EXECUTE ON FUNCTION public.manage_pulse_scheduler_cron(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pulse_cron_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pulse_scheduler_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_pulse_scheduler_cron() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_due_pulse_schedules() TO service_role;
