# Security and Performance Fixes - Company Memberships Self-Reference Bug

**Date:** 2026-01-10

## Issue

After applying security/performance optimizations (migration `20260110184418_fix_security_performance_issues.sql`), users could no longer see their companies in the dropdown.

## Root Cause

The "Admins can read company memberships" policy created a self-referencing query:

```sql
CREATE POLICY "Admins can read company memberships"
  ON public.company_memberships
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = (select auth.uid())
      AND cm.role = 'admin'
    )
  );
```

This policy queries the same table (`company_memberships`) that it protects, causing infinite recursion when PostgreSQL evaluates RLS policies.

## Solution

Created a security definer function `is_company_admin(company_id, user_id)` that bypasses RLS to check admin status:

```sql
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
```

Updated the policies to use this function instead of subquerying the table directly.

## Migration Applied

`fix_company_memberships_self_reference` - Fixes the infinite recursion by using a security definer function.
