/*
  # Grid Templates Feature

  1. New Tables
    - `grid_templates`
      - `id` (uuid, primary key) - Unique identifier for the template
      - `dashboard_cell_id` (uuid, foreign key) - References the parent dashboard cell
      - `name` (text) - Display name for the template
      - `is_default` (boolean) - Whether this is the default template (only one per cell)
      - `column_config` (jsonb) - Stores column positions, widths, and custom names
      - `formatting_rules` (jsonb) - Placeholder for future formatting rules
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on grid_templates table
    - Add policies for authenticated users based on dashboard cell access

  3. Constraints
    - Unique constraint to ensure only one default template per cell
    - Trigger to enforce single default per cell

  4. Notes
    - column_config stores: { columns: [{ field, position, width, title }] }
    - formatting_rules is a placeholder for future conditional formatting
*/

CREATE TABLE IF NOT EXISTS grid_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_cell_id uuid NOT NULL REFERENCES dashboard_cells(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  is_default boolean NOT NULL DEFAULT false,
  column_config jsonb NOT NULL DEFAULT '{"columns": []}',
  formatting_rules jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grid_templates_cell_id ON grid_templates(dashboard_cell_id);
CREATE INDEX IF NOT EXISTS idx_grid_templates_is_default ON grid_templates(dashboard_cell_id, is_default) WHERE is_default = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_grid_templates_single_default 
  ON grid_templates(dashboard_cell_id) 
  WHERE is_default = true;

ALTER TABLE grid_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view grid templates"
  ON grid_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = grid_templates.dashboard_cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

CREATE POLICY "Users can insert grid templates"
  ON grid_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = grid_templates.dashboard_cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );

CREATE POLICY "Users can update grid templates"
  ON grid_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = grid_templates.dashboard_cell_id
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
      WHERE dc.id = grid_templates.dashboard_cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );

CREATE POLICY "Users can delete grid templates"
  ON grid_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_cells dc
      JOIN dashboards d ON d.id = dc.dashboard_id
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE dc.id = grid_templates.dashboard_cell_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  );

CREATE OR REPLACE FUNCTION ensure_single_default_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE grid_templates
    SET is_default = false, updated_at = now()
    WHERE dashboard_cell_id = NEW.dashboard_cell_id
    AND id != NEW.id
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_default_template ON grid_templates;
CREATE TRIGGER trigger_ensure_single_default_template
  BEFORE INSERT OR UPDATE ON grid_templates
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_template();
