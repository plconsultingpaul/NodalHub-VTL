/*
  # Add Sidebar Text Color to Companies

  1. Changes
    - Add `sidebar_text_color` column to `companies` table
    - Stores hex color code for sidebar text (default white #FFFFFF)

  2. Notes
    - Allows customization of sidebar text color alongside primary brand color
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'sidebar_text_color'
  ) THEN
    ALTER TABLE companies ADD COLUMN sidebar_text_color text DEFAULT '#FFFFFF';
  END IF;
END $$;