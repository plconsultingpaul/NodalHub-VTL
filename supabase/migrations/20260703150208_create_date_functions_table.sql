/*
# Create Date Functions Table

1. New Tables
  - `date_functions`
    - `id` (uuid, primary key) - Unique identifier
    - `company_id` (uuid, FK to companies) - Company ownership
    - `name` (text, not null) - Function name e.g. "TodayEnd", "FirstDayOfMonth"
    - `description` (text, nullable) - Human-readable description
    - `base_date` (text, not null) - Base date type: today, today_date_only, first_day_of_month, last_day_of_month, first_day_of_week, last_day_of_week, first_day_of_year, last_day_of_year, first_day_of_last_month, last_day_of_last_month, first_day_of_last_year, last_day_of_last_year
    - `string_format` (text, not null, default 'YYYY-MM-DD') - Output date format
    - `adjust_years` (integer, default 0) - Year offset
    - `adjust_months` (integer, default 0) - Month offset
    - `adjust_days` (integer, default 0) - Day offset
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

2. Security
  - Enable RLS on `date_functions`
  - Company-member-scoped CRUD policies via company_memberships join
  - Only authenticated users with company membership can access

3. Notes
  - These functions compute dynamic date values at runtime (e.g. "today", "first day of this month")
  - Used in Pulse parameters so scheduled runs always get the current computed date
  - The pulse-runner edge function resolves these at execution time
*/

CREATE TABLE IF NOT EXISTS date_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  base_date text NOT NULL DEFAULT 'today_date_only',
  string_format text NOT NULL DEFAULT 'YYYY-MM-DD',
  adjust_years integer NOT NULL DEFAULT 0,
  adjust_months integer NOT NULL DEFAULT 0,
  adjust_days integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE date_functions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_date_functions" ON date_functions;
CREATE POLICY "select_date_functions" ON date_functions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = date_functions.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_date_functions" ON date_functions;
CREATE POLICY "insert_date_functions" ON date_functions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = date_functions.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_date_functions" ON date_functions;
CREATE POLICY "update_date_functions" ON date_functions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = date_functions.company_id
      AND company_memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = date_functions.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_date_functions" ON date_functions;
CREATE POLICY "delete_date_functions" ON date_functions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = date_functions.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );
