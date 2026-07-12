-- Add last_known_columns to store column names from the most recent query execution
ALTER TABLE dashboard_cells ADD COLUMN IF NOT EXISTS last_known_columns text[] DEFAULT '{}';