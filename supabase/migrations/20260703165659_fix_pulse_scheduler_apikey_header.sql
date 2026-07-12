/*
# Fix run_due_pulse_schedules to include apikey header

## Summary
Updates the database scheduler function to include the `apikey` header
in HTTP calls to the pulse-runner edge function. Supabase's API gateway
requires both the Authorization header AND the apikey header for edge
function calls to be properly routed.

## Changes
- Modified `run_due_pulse_schedules()` to include `Apikey` header in the
  net.http_post call to pulse-runner
*/

CREATE OR REPLACE FUNCTION run_due_pulse_schedules()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sched record;
  auth_key text;
  supabase_url text;
  runner_url text;
  req_id bigint;
  invoked_count int := 0;
  next_time timestamptz;
  conn_config jsonb;
BEGIN
  -- Get connection config from system_configuration
  SELECT config_value INTO conn_config
  FROM system_configuration
  WHERE config_key = 'scheduler_connection';

  IF conn_config IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No scheduler_connection config found');
  END IF;

  supabase_url := conn_config->>'supabase_url';
  auth_key := conn_config->>'anon_key';

  IF supabase_url IS NULL OR auth_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing supabase_url or anon_key in config');
  END IF;

  runner_url := supabase_url || '/functions/v1/pulse-runner';

  -- Find all due schedules
  FOR sched IN
    SELECT ps.pulse_id, ps.cron_expression, ps.timezone
    FROM pulse_schedules ps
    INNER JOIN pulses p ON p.id = ps.pulse_id
    WHERE ps.enabled = true
      AND p.is_active = true
      AND (ps.next_run_at IS NULL OR ps.next_run_at <= now())
  LOOP
    -- Compute next run time
    next_time := compute_next_cron_run(sched.cron_expression, sched.timezone);

    -- Update schedule
    UPDATE pulse_schedules
    SET last_scheduled_at = now(),
        next_run_at = next_time,
        updated_at = now()
    WHERE pulse_id = sched.pulse_id;

    -- Invoke pulse-runner via pg_net with both Authorization and Apikey headers
    SELECT net.http_post(
      url := runner_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || auth_key,
        'Apikey', auth_key
      ),
      body := jsonb_build_object(
        'pulseId', sched.pulse_id,
        'triggerSource', 'schedule'
      )
    ) INTO req_id;

    invoked_count := invoked_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invokedCount', invoked_count,
    'ts', now()::text
  );
END;
$$;
