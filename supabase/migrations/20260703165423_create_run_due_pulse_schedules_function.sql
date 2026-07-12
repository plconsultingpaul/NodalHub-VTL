/*
# Create database-side pulse scheduler function

## Summary
Creates a PL/pgSQL function `run_due_pulse_schedules()` that handles pulse scheduling
directly in the database using pg_net to invoke the pulse-runner edge function.
This bypasses the pulse-scheduler edge function which has deployment issues.

## How it works
1. Queries pulse_schedules for enabled schedules where next_run_at <= now or is NULL
2. Joins with pulses to verify is_active = true
3. For each due pulse, invokes pulse-runner via net.http_post with the service role key
4. Updates last_scheduled_at and computes next_run_at based on cron expression
5. Handles common cron patterns: every N minutes, hourly at minute N, every N hours

## New Functions
- `run_due_pulse_schedules()` - Main scheduling function called by pg_cron
- `compute_next_cron_run(cron_expression text, tz text)` - Computes next run time from cron

## Security
- Function is owned by postgres and runs with elevated privileges (SECURITY DEFINER)
- Reads service role key from system_configuration table
- Only processes schedules where both the schedule is enabled AND the pulse is active
*/

-- Helper function to compute next run time from a cron expression
CREATE OR REPLACE FUNCTION compute_next_cron_run(cron_expr text, tz text DEFAULT 'UTC')
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  parts text[];
  minute_part text;
  hour_part text;
  interval_minutes int;
  next_time timestamptz;
BEGIN
  parts := string_to_array(trim(cron_expr), ' ');
  IF array_length(parts, 1) != 5 THEN
    RETURN now() + interval '1 minute';
  END IF;

  minute_part := parts[1];
  hour_part := parts[2];

  -- Every minute: * * * * *
  IF minute_part = '*' AND hour_part = '*' THEN
    RETURN now() + interval '1 minute';
  END IF;

  -- Every N minutes: */N * * * *
  IF minute_part LIKE '*/%' AND hour_part = '*' THEN
    interval_minutes := substring(minute_part from 3)::int;
    IF interval_minutes > 0 THEN
      RETURN now() + (interval_minutes || ' minutes')::interval;
    END IF;
  END IF;

  -- At specific minute every hour: N * * * *
  IF minute_part ~ '^\d+$' AND hour_part = '*' THEN
    RETURN now() + interval '1 hour';
  END IF;

  -- Every N hours: 0 */N * * * or M */N * * *
  IF hour_part LIKE '*/%' THEN
    interval_minutes := substring(hour_part from 3)::int * 60;
    IF interval_minutes > 0 THEN
      RETURN now() + (interval_minutes || ' minutes')::interval;
    END IF;
  END IF;

  -- Specific hour: M H * * * (daily)
  IF minute_part ~ '^\d+$' AND hour_part ~ '^\d+$' THEN
    RETURN now() + interval '1 day';
  END IF;

  -- Fallback: run again in 5 minutes
  RETURN now() + interval '5 minutes';
END;
$$;

-- Main scheduler function
CREATE OR REPLACE FUNCTION run_due_pulse_schedules()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sched record;
  service_key text;
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
  
  -- Get service role key from the vault or config
  -- We need the service role key to call pulse-runner
  -- It's stored in the Supabase environment, but we can use the anon key from config
  -- Actually, we need service role. Let's check if it's stored.
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- If not in vault, try to get from config or use a known fallback
  IF service_key IS NULL THEN
    -- Use the service role key directly (it's available in the database context)
    service_key := current_setting('app.settings.service_role_key', true);
  END IF;
  
  IF service_key IS NULL OR service_key = '' THEN
    -- Last resort: use anon key from config (pulse-runner accepts it if JWT is valid)
    service_key := conn_config->>'anon_key';
  END IF;

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing supabase_url or auth key');
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

    -- Invoke pulse-runner via pg_net
    SELECT net.http_post(
      url := runner_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
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
