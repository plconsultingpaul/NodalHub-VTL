/*
# Add Fixie HTTP Forward Proxy Support

1. New Tables
   - `proxy_configuration`
     - `id` (uuid, primary key)
     - `company_id` (uuid, FK to companies, unique per company)
     - `provider` (text, e.g. 'fixie')
     - `proxy_url` (text, the full proxy URL including credentials)
     - `is_active` (boolean, default true)
     - `description` (text, optional label)
     - `created_at` / `updated_at` (timestamps)

2. Modified Tables
   - `api_endpoints`: Added `use_proxy` boolean column (default false).
     Controls whether outbound requests route through the proxy.

3. Security
   - RLS enabled on `proxy_configuration`.
   - NO browser-accessible policies — only the service-role key (edge functions) can read this table.
     The proxy URL contains credentials and must never be exposed to the frontend.
   - `api_endpoints.use_proxy` is readable via existing endpoint policies.

4. Permission System
   - Updated `user_permissions.permission_type` CHECK constraint to include `proxy_admin`.
     This permission controls who can toggle proxy settings on endpoints.
*/

-- 1. Create proxy_configuration table
CREATE TABLE IF NOT EXISTS proxy_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'fixie',
  proxy_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, provider)
);

ALTER TABLE proxy_configuration ENABLE ROW LEVEL SECURITY;

-- No browser-accessible policies intentionally: only service-role key can read

-- 2. Add use_proxy to api_endpoints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_endpoints' AND column_name = 'use_proxy'
  ) THEN
    ALTER TABLE api_endpoints ADD COLUMN use_proxy boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. Update permission_type CHECK constraint to include proxy_admin
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_permission_type_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_type_check
  CHECK (permission_type IN ('dashboard', 'pulse', 'settings_tab', 'dashboard_edit', 'save_templates', 'edit_grid_layout', 'view_logs', 'sso_application', 'proxy_admin'));
