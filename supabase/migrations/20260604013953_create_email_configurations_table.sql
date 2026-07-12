/*
  # Create Email Configurations Table

  1. New Tables
    - `email_configurations`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text) - display name for the configuration
      - `provider` (text) - 'office365' or 'gmail'
      - `send_from_email` (text) - the email address to send from
      - `credentials` (jsonb) - provider-specific credentials
        - Office365: { tenant_id, client_id, client_secret }
        - Gmail: { client_id, client_secret, refresh_token }
      - `is_default` (boolean) - whether this is the default config for the company
      - `is_configured` (boolean) - whether all required fields are filled
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `email_configurations` table
    - Policies restrict access to company admins only
    - SELECT, INSERT, UPDATE, DELETE policies for authenticated admin users

  3. Important Notes
    - Supports multiple email configurations per company
    - Only one configuration can be marked as default per company
    - Provider field constrains to known providers
*/

CREATE TABLE IF NOT EXISTS email_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT 'office365' CHECK (provider IN ('office365', 'gmail')),
  send_from_email text NOT NULL DEFAULT '',
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_configured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_configurations_company_id ON email_configurations(company_id);

ALTER TABLE email_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins can view email configurations"
  ON email_configurations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = email_configurations.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "Company admins can insert email configurations"
  ON email_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = email_configurations.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "Company admins can update email configurations"
  ON email_configurations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = email_configurations.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = email_configurations.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "Company admins can delete email configurations"
  ON email_configurations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = email_configurations.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  );
