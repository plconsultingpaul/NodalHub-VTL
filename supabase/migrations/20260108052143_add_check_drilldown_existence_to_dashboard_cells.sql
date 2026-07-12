/*
  # Add check_drilldown_existence column to dashboard_cells

  1. Changes
    - Add `check_drilldown_existence` boolean column to `dashboard_cells` table
    - Default value: false (disabled by default for performance)
    
  2. Purpose
    - Controls whether the system pre-checks if drilldown data exists for each row
    - When enabled, only rows with drilldown data show the expand icon
    - When disabled (default), all rows show the expand icon (faster loading)
*/

ALTER TABLE dashboard_cells
ADD COLUMN IF NOT EXISTS check_drilldown_existence boolean DEFAULT false;