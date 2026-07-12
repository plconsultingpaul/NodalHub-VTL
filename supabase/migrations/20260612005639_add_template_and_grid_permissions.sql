-- Expand the permission_type CHECK constraint to include save_templates and edit_grid_layout
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_permission_type_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_type_check 
  CHECK (permission_type IN ('dashboard', 'dashboard_edit', 'pulse', 'settings_tab', 'save_templates', 'edit_grid_layout'));