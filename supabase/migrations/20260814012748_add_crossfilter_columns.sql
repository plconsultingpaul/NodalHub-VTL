/*
# Add CrossFilter columns to dashboards and dashboard_cells

1. Modified Tables
   - `dashboards`: added `crossfilter_enabled` (boolean, default false) — marks a dashboard as a CrossFilter dashboard
   - `dashboard_cells`: added `crossfilter_column` (text, nullable) — the column this cell uses for cross-filtering (separate from auto_group_by_column)

2. Notes
   - CrossFilter is a separate concept from Auto Group By
   - crossfilter_enabled must be true on the dashboard for any crossfilter behavior to activate
   - Each cell can independently opt in/out by setting or clearing crossfilter_column
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dashboards' AND column_name = 'crossfilter_enabled') THEN
    ALTER TABLE dashboards ADD COLUMN crossfilter_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dashboard_cells' AND column_name = 'crossfilter_column') THEN
    ALTER TABLE dashboard_cells ADD COLUMN crossfilter_column text;
  END IF;
END $$;
