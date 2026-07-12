/*
  # Core Tables for Multi-Tenant KPI Dashboard

  1. New Tables
    - `profiles` - User profiles extending Supabase auth
      - `id` (uuid, primary key, references auth.users)
      - `full_name` (text)
      - `email` (text)
      - `avatar_url` (text, nullable)
      - `last_login_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `companies` - Organizations/tenants
      - `id` (uuid, primary key)
      - `name` (text)
      - `logo_url` (text, nullable)
      - `primary_color` (text, default #000000)
      - `secondary_color` (text, default #6B7280)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `company_memberships` - Links users to companies with roles
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `company_id` (uuid, references companies)
      - `role` (text: Admin, Editor, Viewer)
      - `status` (text: active, inactive)
      - `invitation_sent_at` (timestamptz)
      - `invitation_sent_count` (integer)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Profiles: Users can read/update their own profile
    - Companies: Members can read their companies, admins can update
    - Memberships: Users can read their own memberships
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#000000',
  secondary_color text NOT NULL DEFAULT '#6B7280',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Editor', 'Viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  invitation_sent_at timestamptz,
  invitation_sent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = companies.id
      AND company_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update their companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = companies.id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = companies.id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read own memberships"
  ON company_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all memberships in their companies"
  ON company_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'Admin'
    )
  );

CREATE POLICY "Admins can insert memberships"
  ON company_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'Admin'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
    )
  );

CREATE POLICY "Admins can update memberships in their companies"
  ON company_memberships FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'Admin'
    )
  );

CREATE POLICY "Admins can delete memberships in their companies"
  ON company_memberships FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'Admin'
    )
  );

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  pending_company_id uuid;
  pending_role text;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  pending_company_id := (new.raw_user_meta_data->>'pending_company_id')::uuid;
  pending_role := new.raw_user_meta_data->>'pending_role';

  IF pending_company_id IS NOT NULL AND pending_role IS NOT NULL THEN
    INSERT INTO public.company_memberships (user_id, company_id, role)
    VALUES (new.id, pending_company_id, pending_role)
    ON CONFLICT (user_id, company_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE INDEX IF NOT EXISTS idx_memberships_user ON company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company ON company_memberships(company_id);