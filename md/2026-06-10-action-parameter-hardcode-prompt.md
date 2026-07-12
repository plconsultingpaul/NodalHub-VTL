# Action Parameter Mappings: Hardcode & Prompt Targets

**Date:** 2026-06-10

## Summary

Extended dashboard cell action parameter mappings to support two new target types beyond "Column":

- **Hardcode** - A fixed value entered at configuration time, always used as-is.
- **Prompt** - A value requested from the user at execution time via a dialog.

Both new target types include a **Value Type** selector with options: Text, Date, Integer, Double, Boolean.

## Changes

### `src/types/database.ts`
- Added `ActionMappingValueType` type (`'text' | 'date' | 'integer' | 'double' | 'boolean'`).
- Extended `ActionParameterMapping` interface:
  - `target` now accepts `'column' | 'hardcode' | 'prompt'`
  - Added optional `hardcodeValue` field (used when target is `hardcode`)
  - Added optional `valueType` field (used for `hardcode` and `prompt` to indicate data type)

### `src/pages/DashboardViewer/ActionsConfigModal.tsx`
- Each parameter mapping row now shows a **Target** dropdown (Column / Hardcode / Prompt).
- When target is **Column**: shows column dropdown + field picker button (existing behavior).
- When target is **Hardcode**: shows a text input for the value + a Type dropdown.
- When target is **Prompt**: shows only the Type dropdown (value collected at runtime).
- All dropdowns use the `CustomDropdown` component.

### `src/pages/DashboardViewer/actionExecutor.ts`
- `buildParamValues` now handles all three target types:
  - `column` - reads from row data (unchanged)
  - `hardcode` - uses the stored `hardcodeValue`
  - `prompt` - uses values from the `promptValues` parameter
- `executeActionForRow` and `executeActionForRows` now accept an optional `promptValues` argument.
- Added `getPromptMappings()` helper export that returns prompt-type mappings for a given action.

### `src/pages/DashboardViewer/DashboardCell.tsx`
- Added a prompt dialog that appears before action execution when the action has `prompt`-type parameters.
- Dialog renders appropriate input controls based on `valueType` (date picker, number input, boolean select, text input).
- Both execution paths (button actions via `executeActionOnSelectedRows` and context menu actions) check for prompt mappings and show the dialog when needed.
- After the user submits prompt values, execution proceeds with those values passed through to the executor.

## No Database Migration Required

The `parameter_mappings` column on `dashboard_cell_actions` is `jsonb`, so the new fields are stored as additional keys in the existing JSON structure. No schema change is needed.
