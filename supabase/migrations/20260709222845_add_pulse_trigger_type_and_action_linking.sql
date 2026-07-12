/*
# Add Pulse Trigger Type and Cell Action Pulse Linking

## Overview
Enables Cell Actions to trigger a Pulse after successful execution by adding:
1. A trigger type to pulses (scheduled vs action-triggered)
2. Input variables definition on pulses (what variables the pulse expects)
3. A link from cell actions to a pulse with variable mappings

## New Columns on `pulses`
- `trigger_type` (text, NOT NULL, default 'scheduled') - Whether the pulse runs on a schedule or is triggered by a cell action. Values: 'scheduled', 'action'.
- `input_variables` (jsonb, NOT NULL, default '[]') - Array of variable definitions the pulse expects when triggered. Schema: [{ name: string, label: string, dataType: 'text' | 'number' | 'date' }]

## New Columns on `dashboard_cell_actions`
- `post_action_pulse_id` (uuid, nullable) - FK to pulses(id), the pulse to trigger after this action succeeds.
- `pulse_variable_mappings` (jsonb, NOT NULL, default '[]') - Maps pulse input variables to action context values. Schema: [{ variableName: string, source: 'column' | 'hardcode' | 'prompt', sourceValue: string, valueType: 'text' | 'number' | 'date' }]

## Security
- No new RLS changes needed; existing policies on pulses and dashboard_cell_actions cover these columns.

## Important Notes
1. The `post_action_pulse_id` uses ON DELETE SET NULL so deleting a pulse doesn't break existing cell actions.
2. Existing pulses default to trigger_type='scheduled' preserving current behavior.
3. Input variables are stored as JSONB array for flexibility in defining variable schemas.
*/

-- Add trigger_type to pulses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pulses' AND column_name = 'trigger_type'
  ) THEN
    ALTER TABLE pulses ADD COLUMN trigger_type text NOT NULL DEFAULT 'scheduled';
  END IF;
END $$;

-- Add check constraint for trigger_type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'pulses_trigger_type_check'
  ) THEN
    ALTER TABLE pulses ADD CONSTRAINT pulses_trigger_type_check
      CHECK (trigger_type IN ('scheduled', 'action'));
  END IF;
END $$;

-- Add input_variables to pulses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pulses' AND column_name = 'input_variables'
  ) THEN
    ALTER TABLE pulses ADD COLUMN input_variables jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add post_action_pulse_id to dashboard_cell_actions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dashboard_cell_actions' AND column_name = 'post_action_pulse_id'
  ) THEN
    ALTER TABLE dashboard_cell_actions ADD COLUMN post_action_pulse_id uuid REFERENCES pulses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add pulse_variable_mappings to dashboard_cell_actions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dashboard_cell_actions' AND column_name = 'pulse_variable_mappings'
  ) THEN
    ALTER TABLE dashboard_cell_actions ADD COLUMN pulse_variable_mappings jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Index for looking up actions that trigger a specific pulse
CREATE INDEX IF NOT EXISTS idx_dashboard_cell_actions_pulse_id
  ON dashboard_cell_actions(post_action_pulse_id)
  WHERE post_action_pulse_id IS NOT NULL;

-- Index for filtering pulses by trigger type
CREATE INDEX IF NOT EXISTS idx_pulses_trigger_type
  ON pulses(trigger_type);
