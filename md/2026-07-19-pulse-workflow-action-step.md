# 2026-07-19 Pulse Workflow Action Step

## Summary

Added a new **Action** node type to the Pulse workflow canvas. This allows a Pulse to execute a post-query action (an API call marked with `purpose_type = 'action'`) as a discrete step in the workflow, with full parameter mapping from upstream data.

## Changes

### New Files
- `src/pages/PulseBuilder/nodes/ActionNode.tsx` — Visual node component (amber themed) with copy/delete controls
- `src/pages/PulseBuilder/panels/ActionConfigPanel.tsx` — Configuration panel with:
  - Action selector (filtered to queries with `purpose_type === 'action'` and `app_target` of Pulse or Both)
  - Parameter mapping for each user parameter with source options:
    - **Query Result Column** — select a column from an upstream query's response
    - **Hardcoded Value** — type a literal value
    - **Input Variable** — reference a trigger input variable
    - **Fixed Value** — select from company fixed values
    - **Date Function** — use a configured date function
  - Error handling (stop/continue)
  - Timeout and retry configuration

### Modified Files
- `src/pages/PulseBuilder/NodePalette.tsx` — Added Action entry (orange color, Zap icon) between Query and Condition
- `src/pages/PulseBuilder/WorkflowCanvas.tsx` — Registered `action` node type, added ActionConfigPanel rendering, handle step config updates for action nodes
- `src/types/database.ts` — Added `PulseActionStepConfig` interface and included it in the `PulseStepConfig` union type
- `supabase/functions/pulse-runner/index.ts` — Added `action` node execution handler:
  - Resolves parameter mappings from all source types (query columns, hardcoded, input variables, fixed values, date functions)
  - Makes the API call with resolved parameters
  - Logs step results (success/error) with full inputs/outputs for Pulse Logs visibility
  - Follows outgoing edges on success or based on onError config
- `src/pages/ActivityLogs/PulseLogs.tsx` — Added `action` to `STEP_TYPE_LABELS` and `STEP_ICONS` maps

## How It Works

1. Drag an **Action** node from the palette onto the canvas
2. Connect it downstream of a Query node (or Trigger/Condition)
3. Click to configure: select an action, then map each parameter to its data source
4. When the Pulse runs, after the preceding step completes, the Action step resolves all parameter values and executes the configured API call
5. Execution is logged in Pulse Logs with URL, method, resolved parameters, and response status
