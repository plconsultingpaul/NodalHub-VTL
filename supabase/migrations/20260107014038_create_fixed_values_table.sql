/*
  # Create Fixed Values Table

  1. New Tables
    - `fixed_values`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `name` (text, not null)
      - `description` (text)
      - `value_type` (text: 'date', 'datetime', 'integer', 'text')
      - `is_list` (boolean, default false)
      - `single_value` (text) - for single value types
      - `list_values` (jsonb) - array of {value, description} for list types
      - `default_value` (text) - for list types
      - `is_editable` (boolean, default false) - for list types
      - `config` (jsonb) - type-specific settings
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid)

  2. Security
    - Enable RLS on `fixed_values` table
    - Add policies for company members to manage fixed values
*/

CREATE TABLE IF NOT EXISTS fixed_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  value_type text NOT NULL CHECK (value_type IN ('date', 'datetime', 'integer', 'text')),
  is_list boolean DEFAULT false,
  single_value text,
  list_values jsonb DEFAULT '[]'::jsonb,
  default_value text,
  is_editable boolean DEFAULT false,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fixed_values_company_id ON fixed_values(company_id);
CREATE INDEX IF NOT EXISTS idx_fixed_values_value_type ON fixed_values(value_type);

ALTER TABLE fixed_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fixed values for their companies"
  ON fixed_values FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = fixed_values.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create fixed values for their companies"
  ON fixed_values FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = fixed_values.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update fixed values for their companies"
  ON fixed_values FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = fixed_values.company_id
      AND company_memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = fixed_values.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete fixed values for their companies"
  ON fixed_values FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = fixed_values.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );
