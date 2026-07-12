/*
  # Add Percentage-Based Cell Sizing

  1. Changes to `dashboard_cells`
    - Add `width_percent` (numeric) - Width as percentage of row (0-100)
    - Add `height_percent` (numeric) - Height as percentage of total dashboard height (0-100)
    - These enable flexible, resizable cell layouts
  
  2. Notes
    - Cells in the same row should have width_percent values that sum to 100
    - All cells in the same row share the same height_percent
    - Default values maintain backwards compatibility with existing span-based layouts
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_cells' AND column_name = 'width_percent'
  ) THEN
    ALTER TABLE dashboard_cells ADD COLUMN width_percent numeric NOT NULL DEFAULT 100;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_cells' AND column_name = 'height_percent'
  ) THEN
    ALTER TABLE dashboard_cells ADD COLUMN height_percent numeric NOT NULL DEFAULT 100;
  END IF;
END $$;