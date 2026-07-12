# 2026-06-04 - Pulse Query Tab Parameter Inputs

## Summary

When a user selects a Query in the Pulse Builder's Query tab, and that query has user parameters (e.g. `@status`), the tab now displays input fields for each parameter so the user can set values before saving or testing.

## Changes

### Database Migration

- Added `parameter_values` (jsonb, default `'{}'`) column to the `pulses` table. Stores a key/value map of parameter names to their runtime values (e.g. `{"@status": "active"}`).

### Type Update (`src/types/database.ts`)

- Added `parameter_values: Record<string, string>` to the `pulses` Row type.
- Added `parameter_values?: Record<string, string>` to the Insert and Update types.

### Query Tab (`src/pages/PulseBuilder/QueryTab.tsx`)

- When the selected query has `user_parameters`, a "Parameters" section appears between the Query selector and Run Mode.
- For each parameter:
  - If linked to a list-type Fixed Value, renders a dropdown with the list items.
  - Otherwise renders a text or date input based on `dataType`.
  - Pre-populates with the Fixed Value's resolved default when a parameter is first encountered.
- Parameter values are stored in `draft.parameter_values` and persisted with the pulse.
- Changing the selected query resets parameter values.
- The Test Query button now substitutes parameter values into the URL query string, path parameters, and enabled query parameters (matching the same substitution logic used by the Query Manager).
