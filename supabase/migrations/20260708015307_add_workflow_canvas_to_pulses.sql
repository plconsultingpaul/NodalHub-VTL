/*
# Add Workflow Canvas Data to Pulses

## Summary
Adds three new columns to the `pulses` table to support the new visual workflow
canvas designer (ReactFlow-based). Existing pulses remain unchanged as legacy
tab-based (workflow_version = 1).

## New Columns on `pulses`
- `canvas_data` (jsonb, nullable) - Stores the ReactFlow canvas state: array of
  nodes (id, type, position, data) and edges (id, source, target, handles).
  NULL for legacy tab-based pulses.
- `step_configs` (jsonb, nullable) - Stores per-node configuration keyed by node
  ID. Contains schedule config, API endpoint config, email config, condition
  rules, etc. NULL for legacy pulses.
- `workflow_version` (integer, default 1) - Distinguishes legacy tab-based pulses
  (version 1) from the new canvas workflow pulses (version 2). Defaults to 1 so
  all existing pulses remain backward compatible.

## Important Notes
1. This is a non-destructive, additive migration. No existing columns or tables
   are modified or removed.
2. Existing related tables (pulse_schedules, pulse_exports, pulse_emails,
   pulse_post_run_steps) remain intact and functional for version 1 pulses.
3. Version 2 pulses will store all workflow configuration in canvas_data and
   step_configs instead of the separate config tables.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pulses' AND column_name = 'canvas_data'
  ) THEN
    ALTER TABLE public.pulses ADD COLUMN canvas_data jsonb DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pulses' AND column_name = 'step_configs'
  ) THEN
    ALTER TABLE public.pulses ADD COLUMN step_configs jsonb DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pulses' AND column_name = 'workflow_version'
  ) THEN
    ALTER TABLE public.pulses ADD COLUMN workflow_version integer NOT NULL DEFAULT 1;
  END IF;
END $$;
