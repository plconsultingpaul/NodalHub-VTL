/*
# Add Mobile App Settings to Dashboards and Dashboard Cells

## Summary
Adds two new columns to support mobile app visibility and column configuration:

1. Modified Tables:
   - `dashboards`: Added `show_on_mobile` (boolean, default false) — controls whether the dashboard appears in the mobile app
   - `dashboard_cells`: Added `mobile_visible_columns` (text[], default '{}') — whitelist of column names to display on the mobile app grid

## Purpose
The mobile app has limited screen real estate. These columns allow admins to:
- Choose which dashboards are available on mobile
- Select which specific columns are shown in the mobile grid view per cell

## Security
No policy changes needed — existing RLS policies already cover these tables.
*/

-- Add show_on_mobile to dashboards
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dashboards' AND column_name = 'show_on_mobile'
  ) THEN
    ALTER TABLE dashboards ADD COLUMN show_on_mobile boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add mobile_visible_columns to dashboard_cells
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dashboard_cells' AND column_name = 'mobile_visible_columns'
  ) THEN
    ALTER TABLE dashboard_cells ADD COLUMN mobile_visible_columns text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;