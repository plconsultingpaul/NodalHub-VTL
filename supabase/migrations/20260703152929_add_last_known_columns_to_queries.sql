/*
# Add last_known_columns to queries table

1. Modified Tables
   - `queries`
     - `last_known_columns` (text[]) - Array of column names from the most recent test execution.
       Used by Email tab's Insert Results Table to know which fields are available
       without requiring API spec response fields to be pre-defined.

2. Important Notes
   - This mirrors the same pattern used on `dashboard_cells.last_known_columns`.
   - Columns are populated when a user runs a test in the Query tab (Pulse or Query Manager).
   - Falls back to api_endpoint_fields if this is empty.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queries' AND column_name = 'last_known_columns'
  ) THEN
    ALTER TABLE queries ADD COLUMN last_known_columns text[] DEFAULT '{}';
  END IF;
END $$;
