/*
# Imaging Vendors and Document Types

Adds two new tables that let each company register its own third-party
imaging vendor (starting with Parse-It) so a Pulse workflow's Imaging
step can retrieve PDF documents from that vendor.

1. New Tables
   - `imaging_vendors`
     - `id` (uuid, primary key)
     - `company_id` (uuid, references companies, cascade)
     - `name` (text) — friendly display name shown in Settings
     - `vendor_type` (text, currently only 'parse_it')
     - `supabase_url` (text) — vendor's Supabase project URL
     - `anon_key` (text) — vendor's anon key (used by the server-side proxy)
     - `default_bucket_id` (text, nullable)
     - `notes` (text, nullable)
     - `created_by` (uuid, references auth.users)
     - `created_at`, `updated_at`
   - `imaging_document_types`
     - `id` (uuid, primary key)
     - `vendor_id` (uuid, references imaging_vendors, cascade)
     - `remote_id` (text) — the UUID of the document type on the vendor side
     - `name` (text) — friendly label
     - `sort_order` (int, default 0)
     - `created_at`, `updated_at`

2. Security
   - RLS enabled on both tables.
   - Company members can select/update/insert/delete rows for their own company only.
   - Ownership is scoped by `company_id` via `company_memberships`.
*/

CREATE TABLE IF NOT EXISTS imaging_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  vendor_type text NOT NULL DEFAULT 'parse_it',
  supabase_url text NOT NULL,
  anon_key text NOT NULL,
  default_bucket_id text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS imaging_vendors_company_id_idx ON imaging_vendors(company_id);

CREATE TABLE IF NOT EXISTS imaging_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES imaging_vendors(id) ON DELETE CASCADE,
  remote_id text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS imaging_document_types_vendor_id_idx ON imaging_document_types(vendor_id);

ALTER TABLE imaging_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE imaging_document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_company_imaging_vendors" ON imaging_vendors;
CREATE POLICY "select_own_company_imaging_vendors" ON imaging_vendors FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = imaging_vendors.company_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_company_imaging_vendors" ON imaging_vendors;
CREATE POLICY "insert_own_company_imaging_vendors" ON imaging_vendors FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = imaging_vendors.company_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_company_imaging_vendors" ON imaging_vendors;
CREATE POLICY "update_own_company_imaging_vendors" ON imaging_vendors FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = imaging_vendors.company_id AND cm.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = imaging_vendors.company_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_company_imaging_vendors" ON imaging_vendors;
CREATE POLICY "delete_own_company_imaging_vendors" ON imaging_vendors FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = imaging_vendors.company_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_own_company_imaging_doc_types" ON imaging_document_types;
CREATE POLICY "select_own_company_imaging_doc_types" ON imaging_document_types FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM imaging_vendors v
      JOIN company_memberships cm ON cm.company_id = v.company_id
      WHERE v.id = imaging_document_types.vendor_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_company_imaging_doc_types" ON imaging_document_types;
CREATE POLICY "insert_own_company_imaging_doc_types" ON imaging_document_types FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM imaging_vendors v
      JOIN company_memberships cm ON cm.company_id = v.company_id
      WHERE v.id = imaging_document_types.vendor_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_company_imaging_doc_types" ON imaging_document_types;
CREATE POLICY "update_own_company_imaging_doc_types" ON imaging_document_types FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM imaging_vendors v
      JOIN company_memberships cm ON cm.company_id = v.company_id
      WHERE v.id = imaging_document_types.vendor_id AND cm.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM imaging_vendors v
      JOIN company_memberships cm ON cm.company_id = v.company_id
      WHERE v.id = imaging_document_types.vendor_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_company_imaging_doc_types" ON imaging_document_types;
CREATE POLICY "delete_own_company_imaging_doc_types" ON imaging_document_types FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM imaging_vendors v
      JOIN company_memberships cm ON cm.company_id = v.company_id
      WHERE v.id = imaging_document_types.vendor_id AND cm.user_id = auth.uid()
    )
  );
