/*
  # Add parameter_values to pulses

  ## Summary
  Adds a `parameter_values` jsonb column to the `pulses` table so that each pulse
  can store the runtime values for its query's user parameters (e.g. {"@status": "active"}).

  ## Modified Tables
    - `pulses`
      - `parameter_values` (jsonb, default '{}') — stores user parameter values to use at execution time
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pulses' AND column_name = 'parameter_values'
  ) THEN
    ALTER TABLE pulses ADD COLUMN parameter_values jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;
