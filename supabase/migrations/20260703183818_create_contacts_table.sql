/*
# Create contacts table for email address book

## Summary
Adds a contacts table for storing external email recipients that don't need login access.
These contacts appear alongside team members in the email recipient pickers throughout the app.

## New Tables
- `contacts`
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK to companies, NOT NULL) - which company owns this contact
  - `name` (text, NOT NULL) - display name for the contact
  - `email` (text, NOT NULL) - email address
  - `created_at` (timestamptz) - when the contact was created
  - `created_by` (uuid, FK to auth.users) - who created it

## Constraints
- UNIQUE on (company_id, email) to prevent duplicate contacts per company

## Security
- RLS enabled
- SELECT: authenticated users who are members of the contact's company
- INSERT: authenticated users who are members of the contact's company
- UPDATE: authenticated users who are members of the contact's company
- DELETE: authenticated users who are members of the contact's company

## Important Notes
1. Contacts are company-scoped, not user-scoped - all members of a company can see and manage contacts
2. The created_by column tracks who added the contact but doesn't restrict access
*/

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_contacts" ON contacts;
CREATE POLICY "select_contacts" ON contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = contacts.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_contacts" ON contacts;
CREATE POLICY "insert_contacts" ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = contacts.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_contacts" ON contacts;
CREATE POLICY "update_contacts" ON contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = contacts.company_id
      AND company_memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = contacts.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_contacts" ON contacts;
CREATE POLICY "delete_contacts" ON contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = contacts.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );
