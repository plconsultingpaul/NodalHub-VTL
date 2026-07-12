/*
  # Change Grid Templates from Cell-Level to Dashboard-Level

  1. Changes
    - Change `dashboard_cell_id` column to `dashboard_id` in grid_templates table
    - Update foreign key to reference dashboards table instead of dashboard_cells
    - Update all RLS policies to check dashboard access directly
    - Update trigger function to enforce single default per dashboard
    - Update indexes accordingly

  2. Structure Changes
    - column_config now stores: { cells: { [cellId]: { columns: [...] } } }
    - formatting_rules now stores: { cells: { [cellId]: { grid: {...}, columns: {...} } } }

  3. Security
    - All existing RLS policies updated to use dashboard_id
    - Same permission model (Admin/Editor can modify, all can view)

  4. Notes
    - Existing data will be orphaned (templates were per-cell, now per-dashboard)
    - Old data is deleted as part of this migration
*/

DROP TRIGGER IF EXISTS trigger_ensure_single_default_template ON grid_templates;
DROP FUNCTION IF EXISTS ensure_single_default_template();

DROP POLICY IF EXISTS "Users can view grid templates" ON grid_templates;
DROP POLICY IF EXISTS "Users can insert grid templates" ON grid_templates;
DROP POLICY IF EXISTS "Users can update grid templates" ON grid_templates;
DROP POLICY IF EXISTS "Users can delete grid templates" ON grid_templates;

DROP INDEX IF EXISTS idx_grid_templates_cell_id;
DROP INDEX IF EXISTS idx_grid_templates_is_default;
DROP INDEX IF EXISTS idx_grid_templates_single_default;

DELETE FROM grid_templates;

ALTER TABLE grid_templates DROP COLUMN dashboard_cell_id;

ALTER TABLE grid_templates ADD COLUMN dashboard_id uuid NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE;

CREATE INDEX idx_grid_templates_dashboard_id ON grid_templates(dashboard_id);
CREATE INDEX idx_grid_templates_dashboard_default ON grid_templates(dashboard_id, is_default) WHERE is_default = true;

CREATE UNIQUE INDEX idx_grid_templates_single_default 
  ON grid_templates(dashboard_id) 
  WHERE is_default = true;

CREATE POLICY "Users can view grid templates"
  ON grid_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboards d
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE d.id = grid_templates.dashboard_id
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
      SELECT 1 FROM dashboards d
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE d.id = grid_templates.dashboard_id
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
      SELECT 1 FROM dashboards d
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE d.id = grid_templates.dashboard_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('Admin', 'Editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboards d
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE d.id = grid_templates.dashboard_id
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
      SELECT 1 FROM dashboards d
      JOIN company_memberships cm ON cm.company_id = d.company_id
      WHERE d.id = grid_templates.dashboard_id
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
    WHERE dashboard_id = NEW.dashboard_id
    AND id != NEW.id
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_template
  BEFORE INSERT OR UPDATE ON grid_templates
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_template();