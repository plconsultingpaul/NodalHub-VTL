/*
  # Add Theme Preference to Profiles

  1. Changes
    - Add `theme` column to `profiles` table
    - Values: 'light' or 'dark'
    - Default: 'light'

  2. Purpose
    - Store user's dark mode preference
    - Persists across sessions and devices
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'theme'
  ) THEN
    ALTER TABLE profiles ADD COLUMN theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark'));
  END IF;
END $$;