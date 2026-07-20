# 2026-07-20 Query Manager Create Dashboard from Query for Pulse

## Problem

When creating a new query in the Query Manager with "Pulse" selected as the application target, no prompt was shown to create a Pulse (unlike the existing "Create Dashboard" prompt for dashboard-targeted queries). Users had to manually navigate to the Pulse section, create a new Pulse, and then configure the workflow with the query.

## Changes

### `src/pages/QueryManager/index.tsx`

- **New imports**: Added `usePulses` hook, `openPulseBuilder` from context, `ScrollText` icon, and required types (`PulseCanvasData`, `PulseQueryStepConfig`, `PulseStepConfig`).
- **New state**: Added modal state for `showCreatePulse`, pulse name, folder selection, error handling, and creation tracking.
- **New memo**: Added `pulseFolders` (filters projects to `type === 'pulse'`).
- **New trigger**: After saving a new query with `app_target === 'pulse'`, the "Create Pulse" modal automatically opens (paralleling the existing dashboard creation flow).
- **New handler** (`handleCreatePulseSubmit`): Creates a pulse via `createPulse`, then calls `updatePulse` to pre-configure the workflow canvas with:
  - A **trigger node** (Schedule) at position (250, 50)
  - A **query node** pre-linked to the saved query at position (250, 200)
  - An **edge** connecting the trigger to the query node
  - `step_configs` with the query step pre-populated (`queryId`, `queryName`, `stepName`)
  - `workflow_version: 2` and `trigger_type: 'scheduled'`
- **New modal UI**: Uses `CustomDropdown` for folder selection, shows success state with "Open Pulse" button that navigates to the Pulse Builder with the newly created pulse.
