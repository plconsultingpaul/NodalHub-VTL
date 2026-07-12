/*
  # Create API Specifications Tables

  This migration creates the schema for managing uploaded OpenAPI/Swagger specifications.

  ## New Tables

  1. `api_specs`
     - `id` (uuid, primary key) - Unique identifier
     - `company_id` (uuid, foreign key) - Company that owns this spec
     - `api_endpoint_id` (uuid, foreign key) - Reference to parent API endpoint
     - `name` (text) - Spec name extracted from info.title
     - `file_name` (text) - Original uploaded file name
     - `spec_content` (jsonb) - Full OpenAPI/Swagger spec as JSON
     - `version` (text) - Spec version from info.version
     - `description` (text) - Spec description from info.description
     - `endpoint_count` (integer) - Number of endpoints in spec
     - `uploaded_at` (timestamptz) - Upload timestamp
     - `updated_at` (timestamptz) - Last update timestamp

  2. `api_spec_endpoints`
     - `id` (uuid, primary key) - Unique identifier
     - `api_spec_id` (uuid, foreign key) - Reference to parent spec
     - `path` (text) - API endpoint path
     - `method` (text) - HTTP method (GET, POST, PUT, PATCH, DELETE)
     - `summary` (text) - Endpoint description/summary
     - `parameters` (jsonb) - Array of parameter definitions
     - `request_body` (jsonb) - Request body schema
     - `responses` (jsonb) - Response schema definitions
     - `created_at` (timestamptz) - Creation timestamp

  3. `api_endpoint_fields`
     - `id` (uuid, primary key) - Unique identifier
     - `api_spec_endpoint_id` (uuid, foreign key) - Reference to parent endpoint
     - `field_name` (text) - Field name
     - `field_path` (text) - Full path with location prefix ([query], [body], [response])
     - `field_type` (text) - Data type
     - `is_required` (boolean) - Whether field is required
     - `description` (text) - Field description
     - `example` (text) - Example value
     - `format` (text) - Format specification
     - `parent_field_id` (uuid) - For nested field hierarchies
     - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - RLS enabled on all tables
  - Policies restrict access to company members only
*/

-- Create api_specs table
CREATE TABLE IF NOT EXISTS api_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  api_endpoint_id uuid REFERENCES api_endpoints(id) ON DELETE SET NULL,
  name text NOT NULL,
  file_name text NOT NULL,
  spec_content jsonb NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  description text DEFAULT '',
  endpoint_count integer DEFAULT 0,
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create api_spec_endpoints table
CREATE TABLE IF NOT EXISTS api_spec_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_spec_id uuid NOT NULL REFERENCES api_specs(id) ON DELETE CASCADE,
  path text NOT NULL,
  method text NOT NULL,
  summary text DEFAULT '',
  parameters jsonb DEFAULT '[]'::jsonb,
  request_body jsonb,
  responses jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create api_endpoint_fields table
CREATE TABLE IF NOT EXISTS api_endpoint_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_spec_endpoint_id uuid NOT NULL REFERENCES api_spec_endpoints(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_path text NOT NULL,
  field_type text NOT NULL DEFAULT 'string',
  is_required boolean DEFAULT false,
  description text DEFAULT '',
  example text,
  format text,
  parent_field_id uuid REFERENCES api_endpoint_fields(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_api_specs_company ON api_specs(company_id);
CREATE INDEX IF NOT EXISTS idx_api_specs_endpoint ON api_specs(api_endpoint_id);
CREATE INDEX IF NOT EXISTS idx_api_specs_uploaded_at ON api_specs(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_spec_endpoints_spec_id ON api_spec_endpoints(api_spec_id);
CREATE INDEX IF NOT EXISTS idx_api_spec_endpoints_method ON api_spec_endpoints(method);
CREATE INDEX IF NOT EXISTS idx_api_spec_endpoints_path ON api_spec_endpoints(path);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_fields_endpoint_id ON api_endpoint_fields(api_spec_endpoint_id);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_fields_parent ON api_endpoint_fields(parent_field_id);

-- Enable Row Level Security
ALTER TABLE api_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_spec_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_endpoint_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_specs
CREATE POLICY "Users can view api_specs for their companies"
  ON api_specs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and Editors can insert api_specs"
  ON api_specs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

CREATE POLICY "Admins and Editors can update api_specs"
  ON api_specs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

CREATE POLICY "Admins and Editors can delete api_specs"
  ON api_specs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = api_specs.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

-- RLS Policies for api_spec_endpoints (access through parent spec)
CREATE POLICY "Users can view api_spec_endpoints"
  ON api_spec_endpoints FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_specs
      JOIN company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_specs.id = api_spec_endpoints.api_spec_id
      AND company_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and Editors can insert api_spec_endpoints"
  ON api_spec_endpoints FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM api_specs
      JOIN company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_specs.id = api_spec_endpoints.api_spec_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

CREATE POLICY "Admins and Editors can delete api_spec_endpoints"
  ON api_spec_endpoints FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_specs
      JOIN company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_specs.id = api_spec_endpoints.api_spec_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

-- RLS Policies for api_endpoint_fields (access through parent endpoint)
CREATE POLICY "Users can view api_endpoint_fields"
  ON api_endpoint_fields FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_spec_endpoints
      JOIN api_specs ON api_specs.id = api_spec_endpoints.api_spec_id
      JOIN company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_spec_endpoints.id = api_endpoint_fields.api_spec_endpoint_id
      AND company_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and Editors can insert api_endpoint_fields"
  ON api_endpoint_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM api_spec_endpoints
      JOIN api_specs ON api_specs.id = api_spec_endpoints.api_spec_id
      JOIN company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_spec_endpoints.id = api_endpoint_fields.api_spec_endpoint_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );

CREATE POLICY "Admins and Editors can delete api_endpoint_fields"
  ON api_endpoint_fields FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_spec_endpoints
      JOIN api_specs ON api_specs.id = api_spec_endpoints.api_spec_id
      JOIN company_memberships ON company_memberships.company_id = api_specs.company_id
      WHERE api_spec_endpoints.id = api_endpoint_fields.api_spec_endpoint_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role IN ('Admin', 'Editor')
    )
  );
