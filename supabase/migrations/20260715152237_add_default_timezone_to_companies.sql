/*
# Add default_timezone to companies

1. Modified Tables
   - `companies`
     - Added `default_timezone` (text, not null, default 'UTC')
       Stores the company's default timezone used as pre-selection
       when creating new schedule rules, date-related features, etc.

2. Notes
   - Non-destructive: adds a nullable-with-default column.
   - Existing rows get 'UTC' as default.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'default_timezone'
  ) THEN
    ALTER TABLE companies ADD COLUMN default_timezone text NOT NULL DEFAULT 'UTC';
  END IF;
END $$;
