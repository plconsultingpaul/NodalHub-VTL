/*
# Add Lookup Value/Label Fields to Queries Table

1. Modified Tables
   - `queries`
     - `lookup_value_field` (text, nullable) - The field name in query results to use as the option value when this query serves as a lookup source
     - `lookup_label_field` (text, nullable) - The field name in query results to display as the option label when this query serves as a lookup source

2. Purpose
   - Allows lookup configuration (value/label field mappings) to be stored directly on the query itself
   - Eliminates the need to create a separate Fixed Value entry just to configure which fields to use
   - When a query has purpose_type='lookup', these fields define how results map to dropdown options

3. Important Notes
   - These fields are only relevant when purpose_type = 'lookup'
   - Existing Fixed Value-based lookups continue to work unchanged (backward compatible)
   - No security changes needed - inherits existing RLS policies on the queries table
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'queries' AND column_name = 'lookup_value_field'
  ) THEN
    ALTER TABLE queries ADD COLUMN lookup_value_field text DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'queries' AND column_name = 'lookup_label_field'
  ) THEN
    ALTER TABLE queries ADD COLUMN lookup_label_field text DEFAULT NULL;
  END IF;
END $$;