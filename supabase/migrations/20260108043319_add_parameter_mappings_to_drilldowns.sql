/*
  # Add Parameter Mappings to Drilldown Configuration

  1. Changes
    - `dashboard_cell_drilldowns`
      - Add `parameter_mappings` (jsonb) - Stores mappings from parent row fields to drilldown query user parameters
        - Format: {"parameterName": "parentFieldName", ...}
        - Example: {"vendorId": "id"} means pass parent row's "id" field to drilldown's "@vendorId" parameter

  2. Notes
    - This enables drilldown queries with User Parameters to receive values from parent row fields
    - Parameter names should match (case-insensitive) the User Parameter names in the drilldown query
    - Empty object {} means no parameter mappings (backwards compatible with existing drilldowns)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_cell_drilldowns' AND column_name = 'parameter_mappings'
  ) THEN
    ALTER TABLE dashboard_cell_drilldowns ADD COLUMN parameter_mappings jsonb NOT NULL DEFAULT '{}';
  END IF;
END $$;
