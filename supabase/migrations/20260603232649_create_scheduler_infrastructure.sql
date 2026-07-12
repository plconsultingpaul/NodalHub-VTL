/*
  # Scheduler infrastructure (system_configuration + cron functions)

  ## Summary
  Sets up the foundation for the Pulse Schedule Manager. Enables `pg_cron` and
  `pg_net`, creates a generic `system_configuration` key/value table, seeds the
  two configuration rows the Schedule Manager UI needs, and creates the
  SECURITY DEFINER functions that schedule, unschedule, and report on the
  Pulse worker cron job.

  ## 1. Extensions
    - `pg_cron` (in schema `pg_catalog` or `cron` per Supabase defaults)
    - `pg_net` (async HTTP for cron job to call edge functions)

  ## 2. New Tables
    - `system_configuration` (config_key UNIQUE, config_value jsonb)
      Two rows seeded:
        * `pulse_scheduler` - master switch + cron expression
        * `scheduler_connection` - Supabase URL + anon key required by pg_net

  ## 3. Helper Function
    - `is_company_admin()` - returns true if the current authenticated user holds
      the Admin role in ANY company. Used to gate `system_configuration`, which is
      a global infrastructure table not scoped to a single company.

  ## 4. Security
    - RLS on `system_configuration`. Admin-only read/write.

  ## 5. New Functions (SECURITY DEFINER)
    - `manage_pulse_scheduler_cron(p_schedule text)` - creates/updates the cron job.
    - `remove_pulse_scheduler_cron()` - removes the cron job.
    - `get_pulse_scheduler_status()` - returns full status JSON for the UI.
    - `get_pulse_cron_jobs()` - lists active cron jobs (debug helper).

  ## Important Notes
    1. `pg_cron` runs inside Postgres, so it cannot read environment variables. The
       `scheduler_connection` row stores the Supabase URL and anon key needed by
       `net.http_post()` to authenticate against the edge function endpoint.
    2. Until connection settings are populated by the admin via the UI,
       `manage_pulse_scheduler_cron()` will return success=false with a guidance
       message instead of attempting to schedule.
*/

-- 1. Extensions --------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. system_configuration table ----------------------------------------------

CREATE TABLE IF NOT EXISTS system_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_configuration ENABLE ROW LEVEL SECURITY;

-- 3. Helper: is_company_admin -----------------------------------------------

CREATE OR REPLACE FUNCTION is_company_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM company_memberships
    WHERE user_id = auth.uid()
      AND role = 'Admin'
  );
END;
$$;

-- 4. RLS policies on system_configuration -----------------------------------

CREATE POLICY "Admins can read system_configuration"
  ON system_configuration FOR SELECT
  TO authenticated
  USING (is_company_admin());

CREATE POLICY "Admins can insert system_configuration"
  ON system_configuration FOR INSERT
  TO authenticated
  WITH CHECK (is_company_admin());

CREATE POLICY "Admins can update system_configuration"
  ON system_configuration FOR UPDATE
  TO authenticated
  USING (is_company_admin())
  WITH CHECK (is_company_admin());

CREATE POLICY "Admins can delete system_configuration"
  ON system_configuration FOR DELETE
  TO authenticated
  USING (is_company_admin());

-- 5. Seed configuration rows -------------------------------------------------

INSERT INTO system_configuration (config_key, config_value)
VALUES
  (
    'pulse_scheduler',
    jsonb_build_object(
      'enabled', false,
      'schedule', '*/5 * * * *',
      'job_name', 'invoke_pulse_scheduler'
    )
  ),
  (
    'scheduler_connection',
    jsonb_build_object(
      'supabase_url', '',
      'anon_key', ''
    )
  )
ON CONFLICT (config_key) DO NOTHING;

-- 6. manage_pulse_scheduler_cron --------------------------------------------

CREATE OR REPLACE FUNCTION manage_pulse_scheduler_cron(p_schedule text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_anon_key text;
  v_job_id bigint;
  v_existing_job_id bigint;
  v_command text;
  v_conn_config jsonb;
BEGIN
  SELECT config_value INTO v_conn_config
  FROM system_configuration
  WHERE config_key = 'scheduler_connection';

  v_supabase_url := NULLIF(TRIM(v_conn_config->>'supabase_url'), '');
  v_anon_key := NULLIF(TRIM(v_conn_config->>'anon_key'), '');

  IF v_supabase_url IS NULL OR v_anon_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Connection settings not configured',
      'message', 'Please configure the Supabase URL and Anon Key first.'
    );
  END IF;

  SELECT jobid INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'invoke_pulse_scheduler';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  v_command := format(
    'SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:=%L::jsonb) as request_id;',
    v_supabase_url || '/functions/v1/pulse-scheduler',
    '{"Content-Type": "application/json", "Authorization": "Bearer ' || v_anon_key || '"}',
    '{}'
  );

  SELECT cron.schedule(
    'invoke_pulse_scheduler',
    p_schedule,
    v_command
  ) INTO v_job_id;

  UPDATE system_configuration
  SET
    config_value = jsonb_set(
      jsonb_set(
        jsonb_set(config_value, '{enabled}', 'true'::jsonb),
        '{schedule}', to_jsonb(p_schedule)
      ),
      '{last_enabled}', to_jsonb(now()::text)
    ),
    updated_at = now()
  WHERE config_key = 'pulse_scheduler';

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'schedule', p_schedule,
    'message', 'Cron job created successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Failed to create cron job'
  );
END;
$$;

-- 7. remove_pulse_scheduler_cron --------------------------------------------

CREATE OR REPLACE FUNCTION remove_pulse_scheduler_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'invoke_pulse_scheduler';

  IF v_job_id IS NULL THEN
    UPDATE system_configuration
    SET
      config_value = jsonb_set(
        jsonb_set(config_value, '{enabled}', 'false'::jsonb),
        '{last_disabled}', to_jsonb(now()::text)
      ),
      updated_at = now()
    WHERE config_key = 'pulse_scheduler';

    RETURN jsonb_build_object(
      'success', true,
      'message', 'No cron job was scheduled; state synced.'
    );
  END IF;

  PERFORM cron.unschedule(v_job_id);

  UPDATE system_configuration
  SET
    config_value = jsonb_set(
      jsonb_set(config_value, '{enabled}', 'false'::jsonb),
      '{last_disabled}', to_jsonb(now()::text)
    ),
    updated_at = now()
  WHERE config_key = 'pulse_scheduler';

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'message', 'Cron job removed'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 8. get_pulse_scheduler_status ---------------------------------------------

CREATE OR REPLACE FUNCTION get_pulse_scheduler_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_conn_config jsonb;
  v_job_exists boolean;
  v_active_count int;
  v_last_run timestamptz;
  v_connection_configured boolean;
BEGIN
  SELECT config_value INTO v_config
  FROM system_configuration
  WHERE config_key = 'pulse_scheduler';

  SELECT config_value INTO v_conn_config
  FROM system_configuration
  WHERE config_key = 'scheduler_connection';

  v_connection_configured := (
    NULLIF(TRIM(v_conn_config->>'supabase_url'), '') IS NOT NULL
    AND NULLIF(TRIM(v_conn_config->>'anon_key'), '') IS NOT NULL
  );

  SELECT EXISTS(
    SELECT 1 FROM cron.job WHERE jobname = 'invoke_pulse_scheduler'
  ) INTO v_job_exists;

  SELECT COUNT(*) INTO v_active_count
  FROM pulses p
  JOIN pulse_schedules ps ON ps.pulse_id = p.id
  WHERE p.is_active = true
    AND ps.enabled = true;

  SELECT MAX(started_at) INTO v_last_run FROM pulse_executions;

  RETURN jsonb_build_object(
    'enabled', COALESCE((v_config->>'enabled')::boolean, false),
    'job_exists', v_job_exists,
    'schedule', COALESCE(v_config->>'schedule', '*/5 * * * *'),
    'last_enabled', v_config->>'last_enabled',
    'last_disabled', v_config->>'last_disabled',
    'active_pulses_count', v_active_count,
    'last_pulse_run', v_last_run,
    'connection_configured', v_connection_configured,
    'status', CASE
      WHEN v_job_exists AND COALESCE((v_config->>'enabled')::boolean, false) THEN 'running'
      WHEN NOT v_job_exists AND COALESCE((v_config->>'enabled')::boolean, false) THEN 'misconfigured'
      ELSE 'stopped'
    END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'enabled', false,
    'error', SQLERRM,
    'status', 'error'
  );
END;
$$;

-- 9. get_pulse_cron_jobs (debug) ---------------------------------------------

CREATE OR REPLACE FUNCTION get_pulse_cron_jobs()
RETURNS TABLE(jobid bigint, jobname text, schedule text, command text, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT j.jobid, j.jobname, j.schedule, j.command, j.active
  FROM cron.job j
  ORDER BY j.jobid DESC;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;
