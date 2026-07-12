/*
  # Projects, Dashboards, and API Endpoints Tables

  1. New Tables
    - `projects` - Organizational folders for dashboards
      - `id` (uuid, primary key)
      - `name` (text)
      - `company_id` (uuid, references companies)
      - `color` (text, for sidebar indicator dot)
      - `sort_order` (integer)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
    
    - `dashboards` - Individual dashboard pages
      - `id` (uuid, primary key)
      - `name` (text)
      - `project_id` (uuid, references projects)
      - `company_id` (uuid, references companies)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `api_endpoints` - Configured external API endpoints
      - `id` (uuid, primary key)
      - `name` (text)
      - `url` (text)
      - `method` (text: GET, POST, etc.)
      - `headers` (jsonb)
      - `auth_type` (text: none, api_key, bearer, basic)
      - `auth_config` (jsonb, encrypted credentials)
      - `company_id` (uuid, references companies)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
    
    - `dashboard_widgets` - Grid widgets on dashboards
      - `id` (uuid, primary key)
      - `dashboard_id` (uuid, references dashboards)
      - `endpoint_id` (uuid, references api_endpoints)
      - `title` (text)
      - `position_x` (integer)
      - `position_y` (integer)
      - `width` (integer)
      - `height` (integer)
      - `column_config` (jsonb, Tabulator column definitions)
      - `grid_options` (jsonb, pagination, sorting settings)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - All access restricted to company members
    - Only Admins and Editors can create/update/delete
*/

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  color text NOT NULL DEFAULT '#3B82F6',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

-- Create api_endpoints table
CREATE TABLE IF NOT EXISTS api_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  method text NOT NULL DEFAULT 'GET' CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  headers jsonb DEFAULT '{}',
  auth_type text NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'api_key', 'bearer', 'basic')),
  auth_config jsonb DEFAULT '{}',
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_endpoints ENABLE ROW LEVEL SECURITY;

-- Create dashboard_widgets table
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  endpoint_id uuid REFERENCES api_endpoints(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'New Widget',
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 6,
  height integer NOT NULL DEFAULT 4,
  column_config jsonb DEFAULT '[]',
  grid_options jsonb DEFAULT '{"pagination": true, "pageSize": 10, "sortable": true}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Helper function to check company membership
CREATE OR REPLACE FUNCTION is_company_member(check_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_memberships
    WHERE company_id = check_company_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user can edit in company
CREATE OR REPLACE FUNCTION can_edit_company(check_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_memberships
    WHERE company_id = check_company_id
    AND user_id = auth.uid()
    AND role IN ('Admin', 'Editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies for projects
CREATE POLICY "Members can read projects"
  ON projects FOR SELECT
  TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Editors can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_company(company_id));

CREATE POLICY "Editors can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (can_edit_company(company_id))
  WITH CHECK (can_edit_company(company_id));

CREATE POLICY "Editors can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (can_edit_company(company_id));

-- RLS policies for dashboards
CREATE POLICY "Members can read dashboards"
  ON dashboards FOR SELECT
  TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Editors can create dashboards"
  ON dashboards FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_company(company_id));

CREATE POLICY "Editors can update dashboards"
  ON dashboards FOR UPDATE
  TO authenticated
  USING (can_edit_company(company_id))
  WITH CHECK (can_edit_company(company_id));

CREATE POLICY "Editors can delete dashboards"
  ON dashboards FOR DELETE
  TO authenticated
  USING (can_edit_company(company_id));

-- RLS policies for api_endpoints
CREATE POLICY "Members can read endpoints"
  ON api_endpoints FOR SELECT
  TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Editors can create endpoints"
  ON api_endpoints FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_company(company_id));

CREATE POLICY "Editors can update endpoints"
  ON api_endpoints FOR UPDATE
  TO authenticated
  USING (can_edit_company(company_id))
  WITH CHECK (can_edit_company(company_id));

CREATE POLICY "Editors can delete endpoints"
  ON api_endpoints FOR DELETE
  TO authenticated
  USING (can_edit_company(company_id));

-- RLS policies for dashboard_widgets
CREATE POLICY "Members can read widgets"
  ON dashboard_widgets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = dashboard_widgets.dashboard_id
      AND is_company_member(dashboards.company_id)
    )
  );

CREATE POLICY "Editors can create widgets"
  ON dashboard_widgets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = dashboard_widgets.dashboard_id
      AND can_edit_company(dashboards.company_id)
    )
  );

CREATE POLICY "Editors can update widgets"
  ON dashboard_widgets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = dashboard_widgets.dashboard_id
      AND can_edit_company(dashboards.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = dashboard_widgets.dashboard_id
      AND can_edit_company(dashboards.company_id)
    )
  );

CREATE POLICY "Editors can delete widgets"
  ON dashboard_widgets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = dashboard_widgets.dashboard_id
      AND can_edit_company(dashboards.company_id)
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_project ON dashboards(project_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_company ON dashboards(company_id);
CREATE INDEX IF NOT EXISTS idx_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_endpoints_company ON api_endpoints(company_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company ON company_memberships(company_id);