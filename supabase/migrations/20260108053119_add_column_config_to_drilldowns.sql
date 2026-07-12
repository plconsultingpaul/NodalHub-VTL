/*
  # Add Column Configuration to Drilldowns

  1. Changes
    - Add `column_config` column to `dashboard_cell_drilldowns` table
      - JSONB field storing column positions, widths, and titles for drilldown grids
      - Defaults to empty object

  2. Purpose
    - Allows users to customize drilldown grid layouts (column order, widths)
    - Persists layout changes so drilldowns open with saved configuration

  3. Column Config Structure
    - Stores array of column definitions with field, position, width, and title
    - Same format as main grid templates for consistency
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_cell_drilldowns' AND column_name = 'column_config'
  ) THEN
    ALTER TABLE dashboard_cell_drilldowns ADD COLUMN column_config jsonb NOT NULL DEFAULT '{}';
  END IF;
END $$;
