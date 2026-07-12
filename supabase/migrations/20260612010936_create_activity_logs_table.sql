-- Create activity_logs table for user activity tracking
CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('login', 'dashboard_open', 'action_execute', 'csv_export', 'csv_email')),
  resource_name text,
  resource_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins and users with view_logs permission can read logs for their company
CREATE POLICY "select_activity_logs" ON activity_logs FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = activity_logs.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.company_id = activity_logs.company_id
        AND user_permissions.user_id = auth.uid()
        AND user_permissions.permission_type = 'view_logs'
    )
  );

-- Any authenticated user can insert their own logs
CREATE POLICY "insert_activity_logs" ON activity_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Only admins can delete (purge) logs
CREATE POLICY "delete_activity_logs" ON activity_logs FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = activity_logs.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

-- No update needed for logs
-- Indexes for fast filtered queries
CREATE INDEX idx_activity_logs_company_date ON activity_logs(company_id, created_at DESC);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id, company_id);
CREATE INDEX idx_activity_logs_event_type ON activity_logs(company_id, event_type);

-- Add view_logs to user_permissions CHECK constraint
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_permission_type_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_type_check 
  CHECK (permission_type IN ('dashboard', 'dashboard_edit', 'pulse', 'settings_tab', 'save_templates', 'edit_grid_layout', 'view_logs'));