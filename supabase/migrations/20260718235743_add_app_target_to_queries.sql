/*
# Add app_target column to queries table

## Summary
Adds an `app_target` column to the `queries` table to indicate whether a query
is intended for use in Dashboards, Pulses, or Both. This allows the Dashboard Builder
and Pulse Builder to filter and only show relevant queries.

## New Columns
- `queries.app_target` (text, NOT NULL, default 'both') — one of 'dashboard', 'pulse', 'both'

## Indexes
- `idx_queries_app_target` on `queries(app_target)`

## Notes
1. Existing queries default to 'both' so they remain available everywhere.
2. A CHECK constraint enforces valid values.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'queries' AND column_name = 'app_target'
  ) THEN
    ALTER TABLE queries ADD COLUMN app_target text NOT NULL DEFAULT 'both';
    ALTER TABLE queries ADD CONSTRAINT queries_app_target_check CHECK (app_target IN ('dashboard', 'pulse', 'both'));
    CREATE INDEX idx_queries_app_target ON queries(app_target);
  END IF;
END $$;