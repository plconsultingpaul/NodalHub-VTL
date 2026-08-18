/*
# Add Mobile Row Detail (Drilldown) Columns to Dashboard Cells

## Summary
Adds `mobile_drilldown_columns` (text[], default '{}') to `dashboard_cells`.

- `mobile_visible_columns` = fields shown in the mobile MAIN GRID (already exists).
- `mobile_drilldown_columns` = fields shown in the mobile ROW DETAIL window when a
  row is tapped. Empty means show all fields (unchanged current behavior).

## Security
No policy changes needed — existing RLS policies already cover this table.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dashboard_cells' AND column_name = 'mobile_drilldown_columns'
  ) THEN
    ALTER TABLE dashboard_cells ADD COLUMN mobile_drilldown_columns text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;