/*
# Add Mobile Visibility Flag to Dashboard Cell Actions

## Summary
Adds `show_on_mobile` (boolean, default true) to `dashboard_cell_actions` so admins can
choose which row actions are exposed to the mobile app.

- Default `true` preserves current behavior: every existing action stays visible on mobile.
- When set to `false`, the mobile app should hide that action.

## Security
No policy changes needed — existing RLS policies already cover this table.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dashboard_cell_actions' AND column_name = 'show_on_mobile'
  ) THEN
    ALTER TABLE dashboard_cell_actions ADD COLUMN show_on_mobile boolean NOT NULL DEFAULT true;
  END IF;
END $$;