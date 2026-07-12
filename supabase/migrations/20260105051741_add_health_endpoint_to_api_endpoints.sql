/*
  # Add health_endpoint column to api_endpoints table

  1. Changes
    - Add `health_endpoint` column to `api_endpoints` table for storing the health check URL path
    - Column is optional (nullable) text field

  2. Notes
    - This column stores the relative path or full URL for health checks
    - Existing rows will have NULL for this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_endpoints' AND column_name = 'health_endpoint'
  ) THEN
    ALTER TABLE api_endpoints ADD COLUMN health_endpoint text;
  END IF;
END $$;