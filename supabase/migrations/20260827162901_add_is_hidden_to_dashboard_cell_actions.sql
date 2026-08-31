/*
  # Add is_hidden flag to dashboard_cell_actions

  Purpose:
    Allow admins/editors to hide an action from end users (context menu,
    inline buttons, drilldown menus) while keeping it visible and editable
    in the Cell Actions configuration modal. Useful while an action is being
    built or when it has a temporary issue and should be withheld from users
    without deleting it.

  Change:
    1. New column `is_hidden` (boolean, NOT NULL, default false) on
       `dashboard_cell_actions`. Existing rows default to visible.

  Notes:
    - Read/write RLS policies already restrict writes to Admin/Editor and
      allow reads for all active company members, which is the correct
      behavior (admins fetch hidden rows so they can toggle them). No
      policy changes needed.
    - No destructive changes: additive column only.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dashboard_cell_actions'
      AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE dashboard_cell_actions
      ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
  END IF;
END $$;
