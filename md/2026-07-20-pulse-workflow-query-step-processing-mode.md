# Pulse Processing Mode in Query Node

## Summary

Moved the Processing Mode selection (Per Result Set / Per Row / Per Group) into the Query node's config panel in the React Flow workflow canvas.

## Changes

### `src/types/database.ts`

- Added `runMode?: PulseRunMode` and `groupByField?: string | null` to `PulseQueryStepConfig` interface.

### `src/pages/PulseBuilder/panels/ApiEndpointConfigPanel.tsx`

- Added `useState` for `queryColumns` (fetched from `last_known_columns` of the selected query).
- Added a "Processing Mode" section with three radio options:
  - **Per Result Set** (default): process entire result as a single dataset.
  - **Per Row**: run downstream steps once per row.
  - **Per Group**: group rows by a user-selected field, run once per group.
- When "Per Group" is selected, a `CustomDropdown` (or text input fallback) allows choosing the group-by field from the query's known columns.
- Handles the corrupted `last_known_columns` JSON fragment format via rejoin + parse.

### `src/pages/PulseBuilder/index.tsx`

- Imported `PulseQueryStepConfig` type.
- On load: seeds the pulse-level `run_mode`/`group_by_field` into the first query step config if not already present (backward compatibility).
- On save: derives `run_mode`/`group_by_field` from the query step config and writes them to the pulse-level DB columns (keeping the pulse-runner compatible).

### `supabase/functions/pulse-runner/index.ts`

- Updated to first check `step_configs` for a query node's `runMode`/`groupByField` before falling back to pulse-level `run_mode`/`group_by_field`.
- Ensures both old and new pulses work correctly.
