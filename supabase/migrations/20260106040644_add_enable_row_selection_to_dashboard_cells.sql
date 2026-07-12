/*
  # Add Enable Row Selection to Dashboard Cells

  1. Changes
    - Add `enable_row_selection` boolean column to `dashboard_cells` table
    - Default value is false

  2. Purpose
    - Allows users to configure whether a cell shows row selection checkboxes
    - Visual-only feature for now, functionality to be added later
*/

ALTER TABLE dashboard_cells
ADD COLUMN IF NOT EXISTS enable_row_selection boolean DEFAULT false;
