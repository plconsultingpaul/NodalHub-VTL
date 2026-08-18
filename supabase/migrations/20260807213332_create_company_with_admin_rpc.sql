/*
# Atomic Company Creation

## Problem
`INSERT INTO companies ... RETURNING *` fails RLS: the SELECT policy on `companies`
requires a matching row in `company_memberships`, but the caller's admin membership
does not exist until a second INSERT runs. The `.insert().select()` roundtrip
therefore returns 403.

## Fix
Introduce a SECURITY DEFINER function that (a) inserts the company, (b) inserts an
Admin membership for the caller, and (c) returns the new company row — all in one
statement, bypassing the read-after-insert RLS gap.

Only signed-in users can call it (execute granted to `authenticated`; revoked from
`public` and `anon`).
*/

CREATE OR REPLACE FUNCTION public.create_company_with_admin(p_name text)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_company public.companies;
  v_trimmed text := trim(p_name);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_trimmed IS NULL OR length(v_trimmed) = 0 THEN
    RAISE EXCEPTION 'company name is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.companies (name) VALUES (v_trimmed) RETURNING * INTO v_company;

  INSERT INTO public.company_memberships (user_id, company_id, role)
    VALUES (v_uid, v_company.id, 'Admin');

  RETURN v_company;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_with_admin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_company_with_admin(text) TO authenticated;
