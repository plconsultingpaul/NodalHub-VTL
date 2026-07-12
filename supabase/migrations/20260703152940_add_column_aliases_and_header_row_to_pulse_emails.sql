/*
# Add column_aliases and include_header_row to pulse_emails

1. Modified Tables
   - `pulse_emails`
     - `column_aliases` (jsonb) - Map of { field_name: "Display Alias" } for renaming
       columns in the HTML results table embedded in emails.
     - `include_header_row` (boolean) - Whether to render the header row in the HTML
       results table. Defaults to true.

2. Important Notes
   - When `column_aliases` has an entry for a column, the alias is used as the
     header text instead of the raw field name.
   - These work together with the existing `results_table_columns` field which
     controls which columns are included and their order.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulse_emails' AND column_name = 'column_aliases'
  ) THEN
    ALTER TABLE pulse_emails ADD COLUMN column_aliases jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulse_emails' AND column_name = 'include_header_row'
  ) THEN
    ALTER TABLE pulse_emails ADD COLUMN include_header_row boolean NOT NULL DEFAULT true;
  END IF;
END $$;
