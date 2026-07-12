/*
# Add Dynamic Lookup Type to Fixed Values

1. Modified Tables
   - `fixed_values`
     - Added `lookup_query_id` (uuid, nullable) - references a query of purpose_type 'lookup' to fetch dropdown options at runtime
     - Added `lookup_value_field` (text, nullable) - the response field to use as dropdown option value
     - Added `lookup_label_field` (text, nullable) - the response field to use as dropdown option label/description

2. Notes
   - The `value_type` column on `fixed_values` is text and accepts 'lookup' as a new value
   - The `purpose_type` column on `queries` is text and accepts 'lookup' as a new value
   - No constraints are dropped or modified; these are purely additive column additions
   - When value_type = 'lookup', the system will execute the linked query and use the response to populate dropdown options
*/

-- Add lookup-related columns to fixed_values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_values' AND column_name = 'lookup_query_id') THEN
    ALTER TABLE fixed_values ADD COLUMN lookup_query_id uuid REFERENCES queries(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_values' AND column_name = 'lookup_value_field') THEN
    ALTER TABLE fixed_values ADD COLUMN lookup_value_field text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_values' AND column_name = 'lookup_label_field') THEN
    ALTER TABLE fixed_values ADD COLUMN lookup_label_field text;
  END IF;
END $$;