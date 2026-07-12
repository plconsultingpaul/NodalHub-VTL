/*
  # Create pulses table

  ## Summary
  Adds the foundational `pulses` table that holds the core record for each scheduled
  task ("Pulse"). A Pulse belongs to a project (of type 'pulse') and points to a
  saved Query. It records the execution mode (Result Set / Per Row / Per Group) and
  basic activation/run metadata. Configuration tabs (Schedule, Export, Email, Post
  Run) are stored in dedicated sub-tables created in subsequent migrations.

  ## 1. New Tables
    - `pulses`
      - `id` (uuid, PK)
      - `company_id` (uuid, FK -> companies)
      - `project_id` (uuid, FK -> projects)
      - `name` (text, required)
      - `description` (text, nullable)
      - `is_active` (boolean, default false)
      - `query_id` (uuid, FK -> queries, nullable until configured)
      - `run_mode` (text, check 'result_set'|'per_row'|'per_group')
      - `group_by_field` (text, nullable)
      - `last_run_at` (timestamptz, nullable)
      - `last_run_status` (text, nullable)
      - `created_by` / `created_at` / `updated_at`

  ## 2. Security
    - RLS enabled.
    - Members can read; Editors/Admins can create/update/delete.

  ## 3. Indexes
    - `(company_id, project_id)` composite for sidebar listing.
    - `query_id` for back-references.
*/

CREATE TABLE IF NOT EXISTS pulses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  query_id uuid REFERENCES queries(id) ON DELETE SET NULL,
  run_mode text NOT NULL DEFAULT 'result_set'
    CHECK (run_mode IN ('result_set', 'per_row', 'per_group')),
  group_by_field text,
  last_run_at timestamptz,
  last_run_status text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pulses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read pulses"
  ON pulses FOR SELECT
  TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Editors can create pulses"
  ON pulses FOR INSERT
  TO authenticated
  WITH CHECK (can_edit_company(company_id));

CREATE POLICY "Editors can update pulses"
  ON pulses FOR UPDATE
  TO authenticated
  USING (can_edit_company(company_id))
  WITH CHECK (can_edit_company(company_id));

CREATE POLICY "Editors can delete pulses"
  ON pulses FOR DELETE
  TO authenticated
  USING (can_edit_company(company_id));

CREATE INDEX IF NOT EXISTS idx_pulses_company_project
  ON pulses(company_id, project_id);

CREATE INDEX IF NOT EXISTS idx_pulses_query
  ON pulses(query_id);
