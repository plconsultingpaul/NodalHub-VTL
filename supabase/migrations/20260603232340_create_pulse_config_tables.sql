/*
  # Create pulse configuration sub-tables

  ## Summary
  Each Pulse has four optional configuration aspects, each stored in its own row so
  that individual builder tabs (Schedule, Export, Email, Post Run) can be updated
  in isolation. The first three tables use `pulse_id` as their primary key (one
  row per pulse). Post Run steps support multiple ordered rows per pulse to allow
  chained API calls in the future.

  ## 1. New Tables
    - `pulse_schedules` (pulse_id PK)
      - enabled, cron_expression, timezone, last_scheduled_at, next_run_at
    - `pulse_exports` (pulse_id PK)
      - enabled, format ('csv' | 'xlsx'), filename_template, include_headers
    - `pulse_emails` (pulse_id PK)
      - enabled, to_recipients/cc_recipients/bcc_recipients (text[]), subject_template,
        body_template, attach_export, only_send_if_results
    - `pulse_post_run_steps`
      - id PK, pulse_id, sort_order, name, config (jsonb)
      - Placeholder structure to be expanded later.

  ## 2. Security
    - RLS enabled on all four tables.
    - Policies join through `pulses.company_id` so access matches the parent pulse.
    - Members read; Editors/Admins create/update/delete.
*/

-- pulse_schedules ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pulse_schedules (
  pulse_id uuid PRIMARY KEY REFERENCES pulses(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  cron_expression text NOT NULL DEFAULT '0 * * * *',
  timezone text NOT NULL DEFAULT 'UTC',
  last_scheduled_at timestamptz,
  next_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pulse_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read pulse_schedules"
  ON pulse_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_schedules.pulse_id
        AND is_company_member(p.company_id)
    )
  );

CREATE POLICY "Editors can insert pulse_schedules"
  ON pulse_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_schedules.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

CREATE POLICY "Editors can update pulse_schedules"
  ON pulse_schedules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_schedules.pulse_id
        AND can_edit_company(p.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_schedules.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

CREATE POLICY "Editors can delete pulse_schedules"
  ON pulse_schedules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_schedules.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

-- pulse_exports --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pulse_exports (
  pulse_id uuid PRIMARY KEY REFERENCES pulses(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  format text NOT NULL DEFAULT 'csv'
    CHECK (format IN ('csv', 'xlsx')),
  filename_template text NOT NULL DEFAULT '{pulse_name}_{date}',
  include_headers boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pulse_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read pulse_exports"
  ON pulse_exports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_exports.pulse_id
        AND is_company_member(p.company_id)
    )
  );

CREATE POLICY "Editors can insert pulse_exports"
  ON pulse_exports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_exports.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

CREATE POLICY "Editors can update pulse_exports"
  ON pulse_exports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_exports.pulse_id
        AND can_edit_company(p.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_exports.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

CREATE POLICY "Editors can delete pulse_exports"
  ON pulse_exports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_exports.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

-- pulse_emails ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pulse_emails (
  pulse_id uuid PRIMARY KEY REFERENCES pulses(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  to_recipients text[] NOT NULL DEFAULT '{}',
  cc_recipients text[] NOT NULL DEFAULT '{}',
  bcc_recipients text[] NOT NULL DEFAULT '{}',
  subject_template text NOT NULL DEFAULT '{pulse_name} results',
  body_template text NOT NULL DEFAULT '',
  attach_export boolean NOT NULL DEFAULT true,
  only_send_if_results boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pulse_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read pulse_emails"
  ON pulse_emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_emails.pulse_id
        AND is_company_member(p.company_id)
    )
  );

CREATE POLICY "Editors can insert pulse_emails"
  ON pulse_emails FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_emails.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

CREATE POLICY "Editors can update pulse_emails"
  ON pulse_emails FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_emails.pulse_id
        AND can_edit_company(p.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_emails.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

CREATE POLICY "Editors can delete pulse_emails"
  ON pulse_emails FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_emails.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

-- pulse_post_run_steps -------------------------------------------------------

CREATE TABLE IF NOT EXISTS pulse_post_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id uuid NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pulse_post_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read pulse_post_run_steps"
  ON pulse_post_run_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_post_run_steps.pulse_id
        AND is_company_member(p.company_id)
    )
  );

CREATE POLICY "Editors can insert pulse_post_run_steps"
  ON pulse_post_run_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_post_run_steps.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

CREATE POLICY "Editors can update pulse_post_run_steps"
  ON pulse_post_run_steps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_post_run_steps.pulse_id
        AND can_edit_company(p.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_post_run_steps.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

CREATE POLICY "Editors can delete pulse_post_run_steps"
  ON pulse_post_run_steps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_post_run_steps.pulse_id
        AND can_edit_company(p.company_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_pulse_post_run_steps_pulse
  ON pulse_post_run_steps(pulse_id, sort_order);
