/*
  # Add Request Body Support to Queries

  This migration adds columns to store request body configuration for POST/PUT/PATCH API calls.

  ## Changes to `queries` table

  1. New Columns:
    - `request_body_template` (text) - Raw JSON template for the request body
    - `request_body_field_mappings` (jsonb) - Array of field mappings with configuration:
      - fieldName: JSON path to the field (e.g., "inputs.IBOOKING_NUMBER")
      - type: 'hardcoded' or 'parameter'
      - value: Static value or parameter name
      - dataType: 'string', 'integer', 'double', 'boolean', 'datetime'

  ## Notes
  - Request body is used when http_method is POST, PUT, or PATCH
  - Field mappings allow dynamic substitution of values at runtime
*/

-- Add request body columns to queries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queries' AND column_name = 'request_body_template'
  ) THEN
    ALTER TABLE queries ADD COLUMN request_body_template text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queries' AND column_name = 'request_body_field_mappings'
  ) THEN
    ALTER TABLE queries ADD COLUMN request_body_field_mappings jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN queries.request_body_template IS 'JSON template for request body (for POST/PUT/PATCH requests)';
COMMENT ON COLUMN queries.request_body_field_mappings IS 'Array of field mappings [{fieldName, type, value, dataType}]';
