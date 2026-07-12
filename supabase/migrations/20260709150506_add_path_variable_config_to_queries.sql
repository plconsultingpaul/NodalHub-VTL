/*
# Add path_variable_config column to queries table

## Overview
Adds a JSONB column to store path variable configurations for API endpoint queries.
When a user selects an API sub-path from a spec that contains path variables (e.g., 
`orders/{orderId}/status`), the application now stores their configured values in this column.

## Modified Tables
- `queries`
  - `path_variable_config` (jsonb, default '{}') - Stores key-value pairs mapping path variable
    names to their configured values. Keys are variable names (e.g., "orderId"), values are
    either hardcoded strings or dynamic references like "{{response.fieldName}}".

## Important Notes
1. This column complements the existing `user_parameters` with `target: 'path'` mechanism.
   It provides a direct, spec-aware mapping for path variables detected from the API specification.
2. Default is an empty JSON object so existing queries continue to work without modification.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queries' AND column_name = 'path_variable_config'
  ) THEN
    ALTER TABLE queries ADD COLUMN path_variable_config jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;