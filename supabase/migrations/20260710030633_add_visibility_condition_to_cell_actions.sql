/*
# Add visibility_condition column to dashboard_cell_actions

1. Modified Tables
   - `dashboard_cell_actions`
     - Added `visibility_condition` (jsonb, nullable) - stores a condition that determines
       whether the action is visible/enabled based on the current row's data values.
       
       Structure: { "field": "COLUMN_NAME", "operator": "is_not_empty", "value": "" }
       Supported operators: is_not_empty, is_empty, equals, not_equals, contains, greater_than, less_than

2. Important Notes
   - When null, the action is always visible (backwards compatible).
   - The condition is evaluated client-side against the row data at render time.
   - For context menu actions: evaluated against the right-clicked row.
   - For header button actions: evaluated against selected rows.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'dashboard_cell_actions'
    AND column_name = 'visibility_condition'
  ) THEN
    ALTER TABLE public.dashboard_cell_actions
    ADD COLUMN visibility_condition jsonb DEFAULT NULL;
  END IF;
END $$;
