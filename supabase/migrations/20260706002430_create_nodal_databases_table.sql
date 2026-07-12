/*
# Create nodal_databases table

## Summary
Creates a table to store database connection configurations for NodalConnect API endpoints.
These connections are selected when creating SQL Query or Stored Procedure queries.

## New Tables
- `nodal_databases`
  - `id` (uuid, primary key) - Unique identifier
  - `api_endpoint_id` (uuid, not null, FK to api_endpoints) - The NodalConnect endpoint this connection belongs to
  - `name` (text, not null) - Display name (e.g. "TMW Development")
  - `connection_id` (text, not null) - The ID sent to NodalConnect API (e.g. "TMWDEV")
  - `company_id` (uuid, not null, FK to companies) - Company scope
  - `created_at` (timestamptz) - When the record was created

## Security
- RLS enabled on `nodal_databases`
- Authenticated users can read connections for companies they are members of
- Authenticated users can insert/update/delete connections for companies they are admin of
*/

CREATE TABLE IF NOT EXISTS nodal_databases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_endpoint_id uuid NOT NULL REFERENCES api_endpoints(id) ON DELETE CASCADE,
  name text NOT NULL,
  connection_id text NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nodal_databases_company_id ON nodal_databases(company_id);
CREATE INDEX IF NOT EXISTS idx_nodal_databases_api_endpoint_id ON nodal_databases(api_endpoint_id);

ALTER TABLE nodal_databases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_nodal_databases" ON nodal_databases;
CREATE POLICY "select_nodal_databases" ON nodal_databases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = nodal_databases.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_nodal_databases" ON nodal_databases;
CREATE POLICY "insert_nodal_databases" ON nodal_databases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = nodal_databases.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('admin', 'Admin')
    )
  );

DROP POLICY IF EXISTS "update_nodal_databases" ON nodal_databases;
CREATE POLICY "update_nodal_databases" ON nodal_databases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = nodal_databases.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('admin', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = nodal_databases.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('admin', 'Admin')
    )
  );

DROP POLICY IF EXISTS "delete_nodal_databases" ON nodal_databases;
CREATE POLICY "delete_nodal_databases" ON nodal_databases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = nodal_databases.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('admin', 'Admin')
    )
  );