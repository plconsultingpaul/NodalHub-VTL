/*
  # Add type column to projects table

  1. Changes
    - Add `type` column to `projects` table with values 'dashboards' or 'pulse'
    - Default value is 'dashboards' to maintain backward compatibility
    - Existing projects will be assigned type 'dashboards'

  2. Notes
    - This enables separating projects into Dashboards and Pulse sections in the sidebar
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'type'
  ) THEN
    ALTER TABLE projects ADD COLUMN type text NOT NULL DEFAULT 'dashboards';
    ALTER TABLE projects ADD CONSTRAINT projects_type_check CHECK (type IN ('dashboards', 'pulse'));
  END IF;
END $$;