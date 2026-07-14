/*
# Add prompt dialog customization fields to cell actions

1. Modified Tables
- `dashboard_cell_actions`
  - `prompt_title` (text, nullable) - Custom title for the parameter prompt dialog. Defaults to "Enter Parameter Values" in the UI when null.
  - `prompt_description` (text, nullable) - Custom description for the parameter prompt dialog. Defaults to "Provide values for the following parameters before executing." in the UI when null.

2. Notes
- These fields allow admins to customize the prompt dialog header per action.
- Null values mean the UI falls back to sensible defaults.
- No security changes needed - existing RLS policies cover these columns.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dashboard_cell_actions' AND column_name = 'prompt_title') THEN
    ALTER TABLE dashboard_cell_actions ADD COLUMN prompt_title text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dashboard_cell_actions' AND column_name = 'prompt_description') THEN
    ALTER TABLE dashboard_cell_actions ADD COLUMN prompt_description text;
  END IF;
END $$;