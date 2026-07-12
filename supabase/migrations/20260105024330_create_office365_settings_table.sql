/*
  # Create Office 365 Email Settings Table

  1. New Tables
    - `office365_settings`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies, unique constraint)
      - `send_from_email` (text) - The email address to send from
      - `tenant_id` (text) - Azure AD Tenant ID
      - `client_id` (text) - Azure App Client ID
      - `client_secret` (text, encrypted) - Azure App Client Secret
      - `is_configured` (boolean) - Whether the configuration is complete
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `office365_settings` table
    - Add policy for admins to manage their company's Office 365 settings

  3. Indexes
    - Index on company_id for fast lookups
*/

CREATE TABLE IF NOT EXISTS office365_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  send_from_email text NOT NULL DEFAULT '',
  tenant_id text NOT NULL DEFAULT '',
  client_id text NOT NULL DEFAULT '',
  client_secret text NOT NULL DEFAULT '',
  is_configured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT office365_settings_company_id_unique UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_office365_settings_company ON office365_settings(company_id);

ALTER TABLE office365_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read their company Office 365 settings"
  ON office365_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = office365_settings.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "Admins can insert their company Office 365 settings"
  ON office365_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = office365_settings.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "Admins can update their company Office 365 settings"
  ON office365_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = office365_settings.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = office365_settings.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "Admins can delete their company Office 365 settings"
  ON office365_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = office365_settings.company_id
      AND company_memberships.user_id = (select auth.uid())
      AND company_memberships.role = 'Admin'
    )
  );