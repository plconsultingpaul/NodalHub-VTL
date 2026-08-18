/*
# Add widget_type column to dashboard_cells

1. Modified Tables
   - `dashboard_cells`
     - `widget_type` (text, not null, default 'grid') — determines how the cell renders:
       'grid' (data table), 'kpi' (stat card), 'donut' (donut/pie chart),
       'bar' (bar chart), 'bar_list' (horizontal bar list), 'line' (line chart)

2. Important Notes
   - Default is 'grid' so all existing cells continue to work unchanged.
   - Chart-specific configuration (value_field, label_field, colors, etc.)
     is stored in the existing `settings` JSONB column.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'dashboard_cells'
    AND column_name = 'widget_type'
  ) THEN
    ALTER TABLE dashboard_cells
      ADD COLUMN widget_type text NOT NULL DEFAULT 'grid';
  END IF;
END $$;

ALTER TABLE dashboard_cells
  DROP CONSTRAINT IF EXISTS dashboard_cells_widget_type_check;

ALTER TABLE dashboard_cells
  ADD CONSTRAINT dashboard_cells_widget_type_check
  CHECK (widget_type IN ('grid', 'kpi', 'donut', 'bar', 'bar_list', 'line'));