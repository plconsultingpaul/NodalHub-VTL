/*
# Add endpoint_type column to api_endpoints

## Summary
Adds an `endpoint_type` column to the `api_endpoints` table to distinguish between
standard REST API endpoints and NodalConnect API endpoints.

## Modified Tables
- `api_endpoints`
  - New column: `endpoint_type` (text, not null, default 'standard')
    - Values: 'standard' (regular REST API) or 'nodal_connect' (NodalConnect executable management API)

## Notes
1. Only one 'nodal_connect' endpoint should exist per company (enforced in application layer).
2. Existing endpoints default to 'standard' and are unaffected.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'api_endpoints'
    AND column_name = 'endpoint_type'
  ) THEN
    ALTER TABLE api_endpoints ADD COLUMN endpoint_type text NOT NULL DEFAULT 'standard';
  END IF;
END $$;