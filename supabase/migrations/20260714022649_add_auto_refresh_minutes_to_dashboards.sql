/*
# Add auto_refresh_minutes to dashboards

## Summary
Adds a default auto-refresh interval setting to dashboards so users don't have
to manually select the refresh interval each time they open a dashboard.

## New Columns
- `dashboards.auto_refresh_minutes` (integer, nullable, default null)
  - null or 0 means auto-refresh is off
  - positive values (1, 2, 5, 10, 15, 30) set the default interval in minutes

## Notes
1. Nullable to avoid breaking existing dashboards (they default to off).
2. No RLS changes needed — existing dashboard policies already cover this column.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'dashboards'
    AND column_name = 'auto_refresh_minutes'
  ) THEN
    ALTER TABLE dashboards ADD COLUMN auto_refresh_minutes integer DEFAULT NULL;
  END IF;
END $$;