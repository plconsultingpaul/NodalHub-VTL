/*
  # Create Queries Table

  This migration creates the schema for managing Query objects that define reusable 
  data source configurations for widgets and reports.

  ## New Tables

  1. `queries`
     - `id` (uuid, primary key) - Unique identifier
     - `company_id` (uuid, foreign key) - Company that owns this query
     - `name` (text) - User-defined query name
     - `query_type` (text) - Type: 'api_endpoint', 'sql', 'stored_procedure'
     - `api_endpoint_id` (uuid, foreign key) - Reference to API endpoint (for api_endpoint type)
     - `http_method` (text) - HTTP method (GET, POST, PUT, PATCH, DELETE)
     - `api_sub_path` (text) - The API path from spec or manual entry
     - `api_spec_endpoint_id` (uuid, foreign key) - Reference to the spec endpoint
     - `query_parameters` (jsonb) - Enabled parameters with values
     - `url_query_string` (text) - Custom query string override
     - `json_parameters` (jsonb) - JSON body parameters
     - `is_manual_path` (boolean) - Whether path was entered manually
     - `created_by` (uuid) - User who created
     - `created_at` (timestamptz) - Creation timestamp
     - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - RLS enabled with policies for company member access
  - Only Admins and Editors can create/update/delete queries
*/

-- Create queries table
CREATE TABLE IF NOT EXISTS queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  query_type text NOT NULL DEFAULT 'api_endpoint',
  api_endpoint_id uuid REFERENCES api_endpoints(id) ON DELETE SET NULL,
  http_method text NOT NULL DEFAULT 'GET',
  api_sub_path text DEFAULT '',
  api_spec_endpoint_id uuid REFERENCES api_spec_endpoints(id) ON DELETE SET NULL,
  query_parameters jsonb DEFAULT '[]'::jsonb,
  url_query_string text DEFAULT '',
  json_parameters jsonb DEFAULT '{}'::jsonb,
  is_manual_path boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT queries_query_type_check CHECK (query_type IN ('api_endpoint', 'sql', 'stored_procedure')),
  CONSTRAINT queries_http_method_check CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'))
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_queries_company ON queries(company_id);
CREATE INDEX IF NOT EXISTS idx_queries_type ON queries(query_type);
CREATE INDEX IF NOT EXISTS idx_queries_endpoint ON queries(api_endpoint_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON queries(created_at DESC);

-- Enable Row Level Security
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view queries for their companies"
  ON queries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = queries.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and Editors can insert queries"
  ON queries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = queries.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

CREATE POLICY "Admins and Editors can update queries"
  ON queries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = queries.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = queries.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

CREATE POLICY "Admins and Editors can delete queries"
  ON queries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = queries.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );