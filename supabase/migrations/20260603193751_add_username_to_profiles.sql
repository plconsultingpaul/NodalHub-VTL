/*
  # Add username column to profiles

  1. Changes
    - Adds a nullable `username` column to `profiles` table
    - Adds a unique index (case-insensitive) on `username` so users cannot
      register the same name with different casing
    - Existing profiles are unaffected (column is nullable)

  2. Notes
    - Username is optional. Users can still log in with their email.
    - The unique index is partial (excludes NULLs) so accounts without a
      username do not collide.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;
