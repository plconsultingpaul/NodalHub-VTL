/*
# Add column_formats to pulse_emails

1. Modified Tables
  - `pulse_emails`
    - `column_formats` (jsonb, default '{}') - Maps column names to date format strings
      (e.g. {"DEPART_DATE": "YYYY-MM-DD"}) used when rendering the HTML results table in emails.

2. Important Notes
  - This allows per-column date formatting in pulse email results tables.
  - Existing rows default to empty object (no formatting = raw values as before).
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pulse_emails'
      AND column_name = 'column_formats'
  ) THEN
    ALTER TABLE pulse_emails ADD COLUMN column_formats jsonb NOT NULL DEFAULT '{}';
  END IF;
END $$;
