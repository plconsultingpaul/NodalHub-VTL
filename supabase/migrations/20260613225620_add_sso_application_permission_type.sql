-- Drop and recreate the check constraint to include 'sso_application'
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_permission_type_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_type_check
  CHECK (permission_type IN ('dashboard', 'pulse', 'settings_tab', 'dashboard_edit', 'save_templates', 'edit_grid_layout', 'view_logs', 'sso_application'));