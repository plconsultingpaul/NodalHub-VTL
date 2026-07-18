/*
# Add sort_order column to dashboards and pulses

1. Modified Tables
   - `dashboards`: Added `sort_order` integer column (default 0) for custom ordering within folders
   - `pulses`: Added `sort_order` integer column (default 0) for custom ordering within folders

2. Important Notes
   - Allows users to drag-and-drop reorder dashboards and pulses within a project/folder
   - Default of 0 means existing items maintain their current relative order (by created_at)
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dashboards' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE dashboards ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pulses' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE pulses ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;
