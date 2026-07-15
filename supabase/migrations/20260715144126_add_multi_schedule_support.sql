/*
# Add multi-schedule support to pulse_schedules

## Summary
Changes the `pulse_schedules` table from a 1:1 relationship with pulses to a 1:many
relationship, allowing multiple schedule rules per pulse.

## Changes
1. Adds `id` (uuid) column as a new primary key.
2. Adds `label` (text) column for user-friendly schedule names (e.g. "Weekday evenings").
3. Drops the old `pulse_id` primary key constraint and replaces with a unique composite
   on (id). pulse_id becomes a regular foreign key with an index.
4. Adds a unique constraint on (pulse_id, cron_expression) to prevent accidental duplicates.

## Important Notes
1. Existing rows get a generated UUID for the new `id` column.
2. The old `pulse_id` PK is replaced -- code that relied on `onConflict: 'pulse_id'` 
   must be updated to use the new `id` column.
3. RLS policies remain unchanged (they already scope via pulse -> company membership).
*/

-- Add new id column
ALTER TABLE public.pulse_schedules ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Add label column
ALTER TABLE public.pulse_schedules ADD COLUMN IF NOT EXISTS label text DEFAULT '';

-- Populate id for existing rows that might have null
UPDATE public.pulse_schedules SET id = gen_random_uuid() WHERE id IS NULL;

-- Drop old PK constraint (pulse_id as PK)
ALTER TABLE public.pulse_schedules DROP CONSTRAINT IF EXISTS pulse_schedules_pkey;

-- Make id the PK
ALTER TABLE public.pulse_schedules ADD PRIMARY KEY (id);

-- Set NOT NULL on id
ALTER TABLE public.pulse_schedules ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.pulse_schedules ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add index on pulse_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_pulse_schedules_pulse_id ON public.pulse_schedules (pulse_id);

-- Add unique constraint to prevent duplicate cron expressions per pulse
ALTER TABLE public.pulse_schedules ADD CONSTRAINT pulse_schedules_pulse_cron_unique 
  UNIQUE (pulse_id, cron_expression);
