-- Create user_permissions table for granular access control
CREATE TABLE user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  permission_type text NOT NULL CHECK (permission_type IN ('dashboard', 'pulse', 'settings_tab')),
  resource_id text,
  access_level text NOT NULL DEFAULT 'view' CHECK (access_level IN ('view', 'edit', 'access')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id, permission_type, resource_id)
);

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage permissions for their company members
CREATE POLICY "select_permissions" ON user_permissions FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = user_permissions.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "insert_permissions" ON user_permissions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = user_permissions.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "update_permissions" ON user_permissions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = user_permissions.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = user_permissions.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "delete_permissions" ON user_permissions FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = user_permissions.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

-- Index for fast lookups
CREATE INDEX idx_user_permissions_lookup ON user_permissions(user_id, company_id);
CREATE INDEX idx_user_permissions_type ON user_permissions(user_id, company_id, permission_type);