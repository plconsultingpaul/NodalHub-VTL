/*
# Fix compute_next_cron_run hour-range support & run_due_pulse_schedules UPDATE scope

## Summary
Fixes two critical bugs preventing pulses from running on the correct hourly schedule:

1. `compute_next_cron_run()` did not handle hour-range cron patterns (e.g., `0 6-16 * * 6`).
   The function now correctly parses `N-M` in the hour field and finds the next valid hour
   within the range on a matching day-of-week.

2. `run_due_pulse_schedules()` was updating ALL schedule rows for a pulse_id instead of just
   the specific schedule row that was due. This corrupted `next_run_at` on sibling rules
   when a pulse has multiple schedule rules.

## Modified Functions
- `compute_next_cron_run(cron_expr text, tz text)` - Added hour-range handling branch
- `run_due_pulse_schedules()` - Fixed UPDATE WHERE to scope by schedule `id` not `pulse_id`;
  added debug logging to `pulse_schedule_debug_logs` table.

## New Tables
- `pulse_schedule_debug_logs` - Stores debug entries each time the scheduler evaluates a 
  schedule, recording cron expression, computed next time, and whether it was fired.

## Important Notes
1. The hour-range branch handles patterns like `M N-P * * D` (e.g., `0 6-16 * * 6`)
   meaning "at minute M, every hour from N through P, on day(s) D".
2. The UPDATE is now scoped to `WHERE id = sched.id` matching the specific schedule row.
3. Debug logs are inserted for each schedule evaluation to aid troubleshooting.
*/

-- Create debug logging table
CREATE TABLE IF NOT EXISTS public.pulse_schedule_debug_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid,
  pulse_id uuid,
  cron_expression text,
  timezone text,
  computed_next_run timestamptz,
  was_fired boolean DEFAULT true,
  now_at_evaluation timestamptz DEFAULT now(),
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pulse_schedule_debug_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read debug logs" ON public.pulse_schedule_debug_logs;
CREATE POLICY "Authenticated users can read debug logs"
  ON public.pulse_schedule_debug_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service can insert debug logs" ON public.pulse_schedule_debug_logs;
CREATE POLICY "Service can insert debug logs"
  ON public.pulse_schedule_debug_logs FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can delete debug logs" ON public.pulse_schedule_debug_logs;
CREATE POLICY "Service can delete debug logs"
  ON public.pulse_schedule_debug_logs FOR DELETE
  TO authenticated
  USING (true);

-- Recreate compute_next_cron_run with hour-range support
CREATE OR REPLACE FUNCTION compute_next_cron_run(cron_expr text, tz text DEFAULT 'UTC')
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  parts text[];
  minute_part text;
  hour_part text;
  dom_part text;
  dow_part text;
  target_min int;
  target_hour int;
  interval_minutes int;
  now_in_tz timestamp;
  candidate timestamp;
  candidate_tz timestamptz;
  target_days int[];
  target_doms int[];
  d int;
  i int;
  h int;
  current_dow int;
  tz_name text;
  hour_start int;
  hour_end int;
BEGIN
  tz_name := CASE tz
    WHEN 'UTC' THEN 'UTC'
    WHEN 'US/Pacific' THEN 'America/Los_Angeles'
    WHEN 'US/Eastern' THEN 'America/New_York'
    WHEN 'US/Central' THEN 'America/Chicago'
    WHEN 'US/Mountain' THEN 'America/Denver'
    WHEN 'Europe/London' THEN 'Europe/London'
    WHEN 'Europe/Paris' THEN 'Europe/Paris'
    WHEN 'Asia/Tokyo' THEN 'Asia/Tokyo'
    WHEN 'Australia/Sydney' THEN 'Australia/Sydney'
    ELSE tz
  END;

  parts := string_to_array(trim(cron_expr), ' ');
  IF array_length(parts, 1) != 5 THEN
    RETURN now() + interval '1 minute';
  END IF;

  minute_part := parts[1];
  hour_part := parts[2];
  dom_part := parts[3];
  dow_part := parts[5];

  now_in_tz := (now() AT TIME ZONE tz_name);

  -- Every minute: * * * * *
  IF minute_part = '*' AND hour_part = '*' THEN
    RETURN now() + interval '1 minute';
  END IF;

  -- Every N minutes: */N * * * *
  IF minute_part LIKE '*/%' AND hour_part = '*' THEN
    interval_minutes := substring(minute_part from 3)::int;
    IF interval_minutes > 0 THEN
      target_min := ((EXTRACT(MINUTE FROM now_in_tz)::int / interval_minutes) + 1) * interval_minutes;
      IF target_min < 60 THEN
        candidate := date_trunc('hour', now_in_tz) + (target_min || ' minutes')::interval;
      ELSE
        candidate := date_trunc('hour', now_in_tz) + interval '1 hour';
      END IF;
      RETURN candidate AT TIME ZONE tz_name;
    END IF;
  END IF;

  -- At specific minute every hour: N * * * *
  IF minute_part ~ '^\d+$' AND hour_part = '*' AND dom_part = '*' AND dow_part = '*' THEN
    target_min := minute_part::int;
    candidate := date_trunc('hour', now_in_tz) + (target_min || ' minutes')::interval;
    IF candidate <= now_in_tz THEN
      candidate := candidate + interval '1 hour';
    END IF;
    RETURN candidate AT TIME ZONE tz_name;
  END IF;

  -- Every N hours: M */N * * *
  IF minute_part ~ '^\d+$' AND hour_part LIKE '*/%' AND dom_part = '*' AND dow_part = '*' THEN
    target_min := minute_part::int;
    interval_minutes := substring(hour_part from 3)::int;
    target_hour := ((EXTRACT(HOUR FROM now_in_tz)::int / interval_minutes) + 1) * interval_minutes;
    IF target_hour < 24 THEN
      candidate := date_trunc('day', now_in_tz) + (target_hour || ' hours')::interval + (target_min || ' minutes')::interval;
    ELSE
      candidate := date_trunc('day', now_in_tz) + interval '1 day' + (target_min || ' minutes')::interval;
    END IF;
    IF candidate <= now_in_tz THEN
      candidate := candidate + (interval_minutes || ' hours')::interval;
    END IF;
    RETURN candidate AT TIME ZONE tz_name;
  END IF;

  -- *** NEW: Hour-range with day-of-week: M N-P * * D (e.g., 0 6-16 * * 6) ***
  -- Fires at minute M for every hour from N through P on day(s) D
  IF minute_part ~ '^\d+$' AND hour_part ~ '^\d+-\d+$' AND dom_part = '*' AND dow_part != '*' THEN
    target_min := minute_part::int;
    hour_start := split_part(hour_part, '-', 1)::int;
    hour_end := split_part(hour_part, '-', 2)::int;
    
    -- Parse day-of-week (supports comma-separated and range)
    IF dow_part ~ '^\d+-\d+$' THEN
      target_days := ARRAY[]::int[];
      FOR d IN split_part(dow_part, '-', 1)::int .. split_part(dow_part, '-', 2)::int LOOP
        target_days := target_days || d;
      END LOOP;
    ELSE
      target_days := string_to_array(dow_part, ',')::int[];
    END IF;

    -- Search up to 8 days ahead for the next valid slot
    FOR i IN 0..7 LOOP
      candidate := date_trunc('day', now_in_tz) + (i || ' days')::interval;
      current_dow := EXTRACT(DOW FROM candidate)::int;

      IF current_dow = ANY(target_days) THEN
        -- Try each hour in the range on this day
        FOR h IN hour_start..hour_end LOOP
          candidate := date_trunc('day', now_in_tz) + (i || ' days')::interval
                       + (h || ' hours')::interval + (target_min || ' minutes')::interval;
          IF candidate > now_in_tz THEN
            RETURN candidate AT TIME ZONE tz_name;
          END IF;
        END LOOP;
      END IF;
    END LOOP;

    -- Fallback: first valid slot next week
    RETURN (date_trunc('day', now_in_tz) + interval '7 days'
            + (hour_start || ' hours')::interval + (target_min || ' minutes')::interval) AT TIME ZONE tz_name;
  END IF;

  -- *** NEW: Hour-range WITHOUT day-of-week: M N-P * * * ***
  -- Fires at minute M for every hour from N through P every day
  IF minute_part ~ '^\d+$' AND hour_part ~ '^\d+-\d+$' AND dom_part = '*' AND dow_part = '*' THEN
    target_min := minute_part::int;
    hour_start := split_part(hour_part, '-', 1)::int;
    hour_end := split_part(hour_part, '-', 2)::int;

    FOR i IN 0..1 LOOP
      FOR h IN hour_start..hour_end LOOP
        candidate := date_trunc('day', now_in_tz) + (i || ' days')::interval
                     + (h || ' hours')::interval + (target_min || ' minutes')::interval;
        IF candidate > now_in_tz THEN
          RETURN candidate AT TIME ZONE tz_name;
        END IF;
      END LOOP;
    END LOOP;

    -- Fallback: tomorrow at range start
    RETURN (date_trunc('day', now_in_tz) + interval '1 day'
            + (hour_start || ' hours')::interval + (target_min || ' minutes')::interval) AT TIME ZONE tz_name;
  END IF;

  -- Daily at specific time: M H * * *
  IF minute_part ~ '^\d+$' AND hour_part ~ '^\d+$' AND dom_part = '*' AND dow_part = '*' THEN
    target_min := minute_part::int;
    target_hour := hour_part::int;
    candidate := date_trunc('day', now_in_tz) + (target_hour || ' hours')::interval + (target_min || ' minutes')::interval;
    IF candidate <= now_in_tz THEN
      candidate := candidate + interval '1 day';
    END IF;
    RETURN candidate AT TIME ZONE tz_name;
  END IF;

  -- Weekly: M H * * D
  IF minute_part ~ '^\d+$' AND hour_part ~ '^\d+$' AND dom_part = '*' AND dow_part != '*' THEN
    target_min := minute_part::int;
    target_hour := hour_part::int;
    target_days := string_to_array(dow_part, ',')::int[];
    current_dow := EXTRACT(DOW FROM now_in_tz)::int;
    
    FOR i IN 0..7 LOOP
      d := (current_dow + i) % 7;
      IF d = ANY(target_days) THEN
        candidate := date_trunc('day', now_in_tz) + (i || ' days')::interval
                     + (target_hour || ' hours')::interval + (target_min || ' minutes')::interval;
        IF candidate > now_in_tz THEN
          RETURN candidate AT TIME ZONE tz_name;
        END IF;
      END IF;
    END LOOP;
    RETURN (date_trunc('day', now_in_tz) + interval '7 days'
            + (target_hour || ' hours')::interval + (target_min || ' minutes')::interval) AT TIME ZONE tz_name;
  END IF;

  -- Monthly: M H D * *
  IF minute_part ~ '^\d+$' AND hour_part ~ '^\d+$' AND dom_part != '*' AND dow_part = '*' THEN
    target_min := minute_part::int;
    target_hour := hour_part::int;
    target_doms := string_to_array(dom_part, ',')::int[];
    
    FOR i IN 0..62 LOOP
      candidate := date_trunc('day', now_in_tz) + (i || ' days')::interval
                   + (target_hour || ' hours')::interval + (target_min || ' minutes')::interval;
      IF EXTRACT(DAY FROM candidate)::int = ANY(target_doms) AND candidate > now_in_tz THEN
        RETURN candidate AT TIME ZONE tz_name;
      END IF;
    END LOOP;
  END IF;

  RETURN now() + interval '5 minutes';
END;
$$;

-- Recreate run_due_pulse_schedules with fixed UPDATE scope and debug logging
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
    INSERT INTO pulse_schedule_debug_logs (schedule_id, pulse_id, cron_expression, timezone, computed_next_run, was_fired, note)
    VALUES (NULL, NULL, NULL, NULL, NULL, false, 'No scheduler_connection config found');
    RETURN jsonb_build_object('success', false, 'error', 'No scheduler_connection config found');
  END IF;

  supabase_url := conn_config->>'supabase_url';
  
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_key IS NULL THEN
    service_key := current_setting('app.settings.service_role_key', true);
  END IF;
  
  IF service_key IS NULL OR service_key = '' THEN
    service_key := conn_config->>'anon_key';
  END IF;

  IF supabase_url IS NULL OR service_key IS NULL THEN
    INSERT INTO pulse_schedule_debug_logs (schedule_id, pulse_id, cron_expression, timezone, computed_next_run, was_fired, note)
    VALUES (NULL, NULL, NULL, NULL, NULL, false, 'Missing supabase_url or auth key');
    RETURN jsonb_build_object('success', false, 'error', 'Missing supabase_url or auth key');
  END IF;

  runner_url := supabase_url || '/functions/v1/pulse-runner';

  -- Find all due schedules - now selecting schedule id as well
  FOR sched IN
    SELECT ps.id AS schedule_id, ps.pulse_id, ps.cron_expression, ps.timezone, ps.label
    FROM pulse_schedules ps
    INNER JOIN pulses p ON p.id = ps.pulse_id
    WHERE ps.enabled = true
      AND p.is_active = true
      AND (ps.next_run_at IS NULL OR ps.next_run_at <= now())
  LOOP
    -- Compute next run time
    next_time := compute_next_cron_run(sched.cron_expression, sched.timezone);

    -- Log this evaluation
    INSERT INTO pulse_schedule_debug_logs (schedule_id, pulse_id, cron_expression, timezone, computed_next_run, was_fired, note)
    VALUES (sched.schedule_id, sched.pulse_id, sched.cron_expression, sched.timezone, next_time, true,
            'Fired schedule "' || COALESCE(sched.label, '') || '". Next run computed.');

    -- Update ONLY this specific schedule row (not all sibling rows for the same pulse)
    UPDATE pulse_schedules
    SET last_scheduled_at = now(),
        next_run_at = next_time,
        updated_at = now()
    WHERE id = sched.schedule_id;

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

  -- Log when scheduler runs but nothing was due
  IF invoked_count = 0 THEN
    INSERT INTO pulse_schedule_debug_logs (schedule_id, pulse_id, cron_expression, timezone, computed_next_run, was_fired, note)
    VALUES (NULL, NULL, NULL, NULL, NULL, false, 'Scheduler ran - no schedules due at ' || now()::text);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invokedCount', invoked_count,
    'ts', now()::text
  );
END;
$$;

-- Revoke direct access from authenticated (keep security model)
REVOKE EXECUTE ON FUNCTION public.run_due_pulse_schedules() FROM authenticated;
