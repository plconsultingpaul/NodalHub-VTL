/*
# Fix compute_next_cron_run to calculate actual next occurrence with timezone support

## Summary
The previous implementation just added a fixed interval (e.g. now + 1 day for daily schedules),
which caused next_run_at to drift from the intended time. For example, a daily schedule at 11:10 AM
that ran at 11:07 AM would set next_run_at to 11:07 AM the next day instead of 11:10 AM.

## Changes
- Rewrites compute_next_cron_run to compute the actual next matching time for the cron expression
- Adds proper timezone support using AT TIME ZONE
- For interval-based patterns, aligns to the next interval boundary
- For specific-time patterns (daily, weekly, monthly), finds the exact next occurrence

## Modified Functions
- compute_next_cron_run(cron_expr text, tz text) - Now correctly computes next occurrence

## Important Notes
1. Timezone parameter is now used to convert the target hour and minute to UTC for storage
2. Daily schedules (M H * * *) now find the next occurrence of that exact H:M in the given timezone
3. Weekly schedules (M H * * D) find the next matching weekday at the specified time
4. Monthly schedules (M H D * *) find the next matching day-of-month at the specified time
*/

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
  current_dow int;
  tz_name text;
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

  IF minute_part = '*' AND hour_part = '*' THEN
    RETURN now() + interval '1 minute';
  END IF;

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

  IF minute_part ~ '^\d+$' AND hour_part = '*' AND dom_part = '*' AND dow_part = '*' THEN
    target_min := minute_part::int;
    candidate := date_trunc('hour', now_in_tz) + (target_min || ' minutes')::interval;
    IF candidate <= now_in_tz THEN
      candidate := candidate + interval '1 hour';
    END IF;
    RETURN candidate AT TIME ZONE tz_name;
  END IF;

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

  IF minute_part ~ '^\d+$' AND hour_part ~ '^\d+$' AND dom_part = '*' AND dow_part = '*' THEN
    target_min := minute_part::int;
    target_hour := hour_part::int;
    candidate := date_trunc('day', now_in_tz) + (target_hour || ' hours')::interval + (target_min || ' minutes')::interval;
    IF candidate <= now_in_tz THEN
      candidate := candidate + interval '1 day';
    END IF;
    RETURN candidate AT TIME ZONE tz_name;
  END IF;

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
