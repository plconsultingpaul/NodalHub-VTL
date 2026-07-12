/*
# Update scheduler RPC to use database-direct scheduling

## Summary
Updates `manage_pulse_scheduler_cron` to create a pg_cron job that calls
`run_due_pulse_schedules()` directly instead of routing through the
pulse-scheduler edge function. This is more reliable and eliminates
the edge function from the scheduling loop.

## Changes
- `manage_pulse_scheduler_cron(p_schedule text)`: Now creates a cron job 
  that calls `SELECT run_due_pulse_schedules()` directly instead of 
  using pg_net to call the pulse-scheduler edge function.
- No longer requires connection settings (supabase_url, anon_key) for
  the scheduler cron job itself, since it runs in-database.
- Connection settings are still used by `run_due_pulse_schedules()` to
  call pulse-runner.
*/

CREATE OR REPLACE FUNCTION manage_pulse_scheduler_cron(p_schedule text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id bigint;
  v_existing_job_id bigint;
  v_conn_config jsonb;
BEGIN
  -- Verify connection settings exist (needed by run_due_pulse_schedules to call pulse-runner)
  SELECT config_value INTO v_conn_config
  FROM system_configuration
  WHERE config_key = 'scheduler_connection';

  IF v_conn_config IS NULL OR 
     NULLIF(TRIM(v_conn_config->>'supabase_url'), '') IS NULL OR
     NULLIF(TRIM(v_conn_config->>'anon_key'), '') IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Connection settings not configured',
      'message', 'Please configure the Supabase URL and Anon Key first.'
    );
  END IF;

  -- Remove existing job if any
  SELECT jobid INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'invoke_pulse_scheduler';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  -- Create new cron job that calls the database function directly
  SELECT cron.schedule(
    'invoke_pulse_scheduler',
    p_schedule,
    'SELECT run_due_pulse_schedules()'
  ) INTO v_job_id;

  -- Update system config to reflect enabled state
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
