/*
  # Dashboard Cells and Drilldown Configuration

  1. New Tables
    - `dashboard_cells`
      - `id` (uuid, primary key) - Unique identifier for the cell
      - `dashboard_id` (uuid, foreign key) - References the parent dashboard
      - `query_id` (uuid, foreign key, nullable) - Main query attached to this cell
      - `title` (text) - Display title for the cell
      - `row_index` (integer) - Row position in the grid (0-based)
      - `col_index` (integer) - Column position in the grid (0-based)
      - `row_span` (integer) - Number of rows this cell spans
      - `col_span` (integer) - Number of columns this cell spans
      - `settings` (jsonb) - Cell-specific settings (display options, etc.)
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `dashboard_cell_drilldowns`
      - `id` (uuid, primary key) - Unique identifier for the drilldown
      - `cell_id` (uuid, foreign key) - References the parent cell
      - `query_id` (uuid, foreign key) - Query to execute for drilldown
      - `display_name` (text) - Label shown in the UI
      - `link_field` (text) - Field name that links parent row to drilldown query
      - `sort_order` (integer) - Order of drilldowns within a cell
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage cells/drilldowns for dashboards they have access to

  3. Notes
    - Cells support flexible grid layouts with row/col spanning
    - Multiple drilldowns can be attached to a single cell
    - Drilldowns execute based on link_field value from parent row
*/

-- Create dashboard_cells table
CREATE TABLE IF NOT EXISTS dashboard_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  query_id uuid REFERENCES queries(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  row_index integer NOT NULL DEFAULT 0,
  col_index integer NOT NULL DEFAULT 0,
  row_span integer NOT NULL DEFAULT 1,
  col_span integer NOT NULL DEFAULT 1,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create dashboard_cell_drilldowns table
CREATE TABLE IF NOT EXISTS dashboard_cell_drilldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id uuid NOT NULL REFERENCES dashboard_cells(id) ON DELETE CASCADE,
  query_id uuid NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  link_field text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_cells_dashboard_id ON dashboard_cells(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_cells_query_id ON dashboard_cells(query_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_cell_drilldowns_cell_id ON dashboard_cell_drilldowns(cell_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_cell_drilldowns_query_id ON dashboard_cell_drilldowns(query_id);

-- Enable RLS
ALTER TABLE dashboard_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_cell_drilldowns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dashboard_cells
-- Users can view cells for dashboards they have access to
CREATE POLICY "Users can view dashboard cells"
  ON dashboard_cells
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboards d
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE d.id = dashboard_cells.dashboard_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- Users can insert cells for dashboards they have access to (Admin/Editor)
CREATE POLICY "Users can insert dashboard cells"
  ON dashboard_cells
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboards d
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE d.id = dashboard_cells.dashboard_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );

-- Users can update cells for dashboards they have access to (Admin/Editor)
CREATE POLICY "Users can update dashboard cells"
  ON dashboard_cells
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboards d
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE d.id = dashboard_cells.dashboard_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboards d
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE d.id = dashboard_cells.dashboard_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );

-- Users can delete cells for dashboards they have access to (Admin/Editor)
CREATE POLICY "Users can delete dashboard cells"
  ON dashboard_cells
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboards d
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE d.id = dashboard_cells.dashboard_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );

-- RLS Policies for dashboard_cell_drilldowns
-- Users can view drilldowns for cells they have access to
CREATE POLICY "Users can view cell drilldowns"
  ON dashboard_cell_drilldowns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = dashboard_cell_drilldowns.cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- Users can insert drilldowns for cells they have access to (Admin/Editor)
CREATE POLICY "Users can insert cell drilldowns"
  ON dashboard_cell_drilldowns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = dashboard_cell_drilldowns.cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );

-- Users can update drilldowns for cells they have access to (Admin/Editor)
CREATE POLICY "Users can update cell drilldowns"
  ON dashboard_cell_drilldowns
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = dashboard_cell_drilldowns.cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = dashboard_cell_drilldowns.cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );

-- Users can delete drilldowns for cells they have access to (Admin/Editor)
CREATE POLICY "Users can delete cell drilldowns"
  ON dashboard_cell_drilldowns
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = dashboard_cell_drilldowns.cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );
