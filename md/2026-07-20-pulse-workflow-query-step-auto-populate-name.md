# 2026-07-20 Pulse Workflow Query Step Auto-Populate Step Name

## Problem

When selecting a Query from the dropdown in the Pulse Workflow Query Step configuration panel, the Step Name field remained blank even though the user had not entered anything. Users had to manually type the step name, which was redundant since a sensible default (the query name) was available.

## Changes

### `src/pages/PulseBuilder/panels/ApiEndpointConfigPanel.tsx`

- Updated the query dropdown `onChange` handler to auto-populate `stepName` and `name` with the selected query's name when the Step Name field is currently empty.
- If the user has already typed a step name, the selection does not overwrite it.
