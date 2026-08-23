ALTER TABLE dashboard_cell_actions
  ADD COLUMN IF NOT EXISTS requires_confirmation boolean NOT NULL DEFAULT false;

ALTER TABLE dashboard_cell_actions
  ADD COLUMN IF NOT EXISTS confirmation_message text;
