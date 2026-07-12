-- Add 'both' as a valid display_mode option for cell actions
ALTER TABLE dashboard_cell_actions DROP CONSTRAINT IF EXISTS dashboard_cell_actions_display_mode_check;
ALTER TABLE dashboard_cell_actions ADD CONSTRAINT dashboard_cell_actions_display_mode_check
  CHECK (display_mode IN ('context_menu', 'button', 'both'));