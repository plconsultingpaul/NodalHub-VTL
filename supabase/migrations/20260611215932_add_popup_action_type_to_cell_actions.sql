-- Add action_type column to distinguish execute vs popup actions
ALTER TABLE dashboard_cell_actions 
  ADD COLUMN action_type text NOT NULL DEFAULT 'execute';

-- Add popup_template column to store popup content configuration
ALTER TABLE dashboard_cell_actions 
  ADD COLUMN popup_template jsonb;

-- Make query_id nullable since popup actions don't need a query
ALTER TABLE dashboard_cell_actions 
  ALTER COLUMN query_id DROP NOT NULL;