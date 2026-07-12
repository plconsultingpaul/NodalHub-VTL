/*
  # Add results table columns to pulse_emails

  1. Modified Tables
    - `pulse_emails`
      - `results_table_columns` (jsonb) - Array of column names to include in HTML results table
      - `include_results_table` (boolean) - Whether to render the results table in the email body

  2. Important Notes
    - When include_results_table is true and {results_table} token is in body_template,
      the pulse-runner renders an HTML table from the query results using the selected columns
    - If results_table_columns is empty/null, all columns are included
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulse_emails' AND column_name = 'include_results_table'
  ) THEN
    ALTER TABLE pulse_emails ADD COLUMN include_results_table boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulse_emails' AND column_name = 'results_table_columns'
  ) THEN
    ALTER TABLE pulse_emails ADD COLUMN results_table_columns jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
