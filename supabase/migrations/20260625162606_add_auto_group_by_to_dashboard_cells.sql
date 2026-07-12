ALTER TABLE dashboard_cells ADD COLUMN auto_group_by_column text;
ALTER TABLE dashboard_cells ADD COLUMN auto_group_collapsed boolean DEFAULT false;