/*
  # Create pulse_executions table

  ## Summary
  Tracks every run of a Pulse for diagnostics and the Schedule Manager status panel.
  Rows are written by the worker edge function (using the service role, which
  bypasses RLS), and read by company members for visibility into recent activity.

  ## 1. New Tables
    - `pulse_executions`
      - `id` (uuid, PK)
      - `pulse_id` (uuid, FK -> pulses)
      - `started_at` / `finished_at` (timestamptz)
      - `status` ('running' | 'success' | 'error' | 'partial')
      - `trigger_source` ('manual' | 'schedule')
      - `row_count` (int)
      - `error_message` (text)
      - `result_summary` (jsonb) - small JSON describing what ran
      - `export_path` (text) - path inside the storage bucket, if any

  ## 2. Security
    - RLS enabled.
    - Members can read executions for pulses in their company.
    - No authenticated INSERT/UPDATE/DELETE policies are defined; only the service
      role (used by the worker edge function) can write rows. Service role
      automatically bypasses RLS.

  ## 3. Indexes
    - `(pulse_id, started_at DESC)` for fast "most recent runs" queries.
*/

CREATE TABLE IF NOT EXISTS pulse_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_id uuid NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'error', 'partial')),
  trigger_source text NOT NULL DEFAULT 'manual'
    CHECK (trigger_source IN ('manual', 'schedule')),
  row_count integer NOT NULL DEFAULT 0,
  error_message text,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  export_path text
);

ALTER TABLE pulse_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read pulse_executions"
  ON pulse_executions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pulses p
      WHERE p.id = pulse_executions.pulse_id
        AND is_company_member(p.company_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_pulse_executions_pulse_started
  ON pulse_executions(pulse_id, started_at DESC);
