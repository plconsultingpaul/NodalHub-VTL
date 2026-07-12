/*
# Update activity_logs event_type CHECK constraint

1. Modified Tables
   - `activity_logs`
     - Updated CHECK constraint on `event_type` to include all valid event types

2. Changes
   - Drops existing `activity_logs_event_type_check` constraint
   - Adds new constraint with complete list of event types:
     login, dashboard_open, action_execute, action_failed, pulse_trigger,
     csv_export, csv_email, user_deactivated, user_activated

3. Important Notes
   - The original constraint only included: login, dashboard_open, action_execute, csv_export, csv_email
   - Missing types (action_failed, pulse_trigger, user_deactivated, user_activated) caused
     INSERT failures when the app tried to log these events
*/

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_event_type_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_event_type_check
  CHECK (event_type IN ('login', 'dashboard_open', 'action_execute', 'action_failed', 'pulse_trigger', 'csv_export', 'csv_email', 'user_deactivated', 'user_activated'));
