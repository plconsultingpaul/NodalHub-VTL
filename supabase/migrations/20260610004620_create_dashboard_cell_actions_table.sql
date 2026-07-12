-- Create dashboard_cell_actions table
-- Stores action queries that can be triggered from a dashboard cell
-- via right-click context menu or header buttons
CREATE TABLE IF NOT EXISTS dashboard_cell_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id uuid NOT NULL REFERENCES dashboard_cells(id) ON DELETE CASCADE,
  query_id uuid NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  display_mode text NOT NULL DEFAULT 'context_menu' CHECK (display_mode IN ('context_menu', 'button')),
  parameter_mappings jsonb NOT NULL DEFAULT '[]',
  sort_order integer NOT NULL DEFAULT 0,
  refresh_after_execute boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_dashboard_cell_actions_cell_id ON dashboard_cell_actions(cell_id);
CREATE INDEX idx_dashboard_cell_actions_query_id ON dashboard_cell_actions(query_id);

-- Enable RLS
ALTER TABLE dashboard_cell_actions ENABLE ROW LEVEL SECURITY;

-- Users can view actions for cells they have access to
CREATE POLICY "Users can view cell actions"
  ON dashboard_cell_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = dashboard_cell_actions.cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- Users can insert actions for cells they have access to (Admin/Editor)
CREATE POLICY "Users can insert cell actions"
  ON dashboard_cell_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = dashboard_cell_actions.cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );

-- Users can update actions for cells they have access to (Admin/Editor)
CREATE POLICY "Users can update cell actions"
  ON dashboard_cell_actions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = dashboard_cell_actions.cell_id
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
      WHERE dc.id = dashboard_cell_actions.cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );

-- Users can delete actions for cells they have access to (Admin/Editor)
CREATE POLICY "Users can delete cell actions"
  ON dashboard_cell_actions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = dashboard_cell_actions.cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );