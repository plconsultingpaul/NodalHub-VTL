/*
# Restrict pg_net access

## Summary
Since pg_net cannot be moved from the public schema (it doesn't support SET SCHEMA),
we restrict direct access to its functions from anon and public roles.

## Changes
- Revoke USAGE on pg_net functions from anon and public roles.
- Only service_role and postgres should be able to use net.http_* functions.

## Note on pg_net
The `pg_net` extension is a Supabase platform-managed extension that does not support
schema relocation. This is a known platform limitation. The mitigation is to revoke
direct access from API-facing roles.
*/

-- Revoke access to pg_net functions from anon and public
DO $$
DECLARE
  func_oid oid;
BEGIN
  FOR func_oid IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_extension e ON TRUE
    JOIN pg_depend d ON d.objid = p.oid AND d.refobjid = e.oid
    WHERE e.extname = 'pg_net'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', func_oid::regprocedure);
  END LOOP;
END $$;
