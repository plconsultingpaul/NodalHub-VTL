# 2026-07-19 Action Step Query Field Picker

## Summary

Updated the Action step's parameter mapping in the Pulse workflow to include a "Query Field" source option with a `{ }` field picker button that lets users select columns from upstream query results.

## Changes

### Modified Files

- **`src/pages/PulseBuilder/panels/ActionConfigPanel.tsx`**
  - Renamed source option from "Query Result Column" to "Query Field"
  - Changed filter logic: "Query Field" now shows whenever there's at least one upstream query node (not hidden when columns are empty)
  - Added `QueryFieldPicker` component with:
    - A `{ }` (Braces icon) button that toggles a CustomDropdown of available fields
    - When a field is selected, displays it in an amber-highlighted chip with the `{ }` icon
    - When no columns are available (query hasn't been tested), shows a text input fallback with a disabled `{ }` button as a hint
  - Added `useState` and `Braces` icon imports
  - Added `'query_field'` to the ParameterMapping source union type

- **`src/types/database.ts`**
  - Added `'query_field'` to the `PulseActionStepConfig.parameterMappings[].source` union type

- **`supabase/functions/pulse-runner/index.ts`**
  - Added `"query_field"` as an alias for `"query_column"` in the parameter resolution switch (both resolve identically from upstream context data)

## How It Works

1. In the Action config panel, select "Query Field" as the parameter source
2. Click the `{ }` button to open a dropdown of available fields from the upstream query
3. Fields are populated from the query's `last_known_columns` (set when the query is tested in Query Manager)
4. If no columns are available yet, the user can manually type a `variableName::columnName` reference or test the query first
5. At runtime, the pulse-runner resolves the field by looking up the column value from the first row of the upstream query's stored response
