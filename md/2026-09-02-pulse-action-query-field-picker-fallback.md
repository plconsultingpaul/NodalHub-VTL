# Pulse Action Query Field picker — fall back to Query Manager Result Columns

## Problem
On the Pulse Action step, choosing source **Query Field** left the `{}` field picker
button greyed out even when the upstream Workflow Query pointed at a query in
Query Manager that had Result Columns defined.

Root cause: the Action config panel only surfaced columns when they were present
inline on the workflow Query node (`node.lastKnownColumns`) OR when they were
already cached in the `useQueries` hook in a very narrow shape. If the columns
were stored as objects, as a JSON-encoded string, or if the cached query row
happened to not include `last_known_columns` yet, the picker's options array
came back empty and the button was disabled.

## Fix
`src/pages/PulseBuilder/panels/ActionConfigPanel.tsx`

- Added `normalizeColumnNames()` which accepts any of the shapes seen in the
  wild: an array of strings, an array of `{name, ...}` objects, a JSON-encoded
  string of either, or a mixed array. Returns a de-duplicated `string[]`.
- Rewrote `upstreamColumnOptions` to merge columns from three sources for each
  upstream query node: the workflow node's snapshot, the query row already in
  the `useQueries` cache, and a **direct Supabase read** of
  `queries.last_known_columns` for the referenced query.
- Added an on-demand Supabase fetch that fires when the local caches don't yet
  have columns for a queryId, and stores results in local state keyed by
  queryId. This is what makes the picker "look at Query Manager Result
  Columns" when the Workflow Query itself has no fields yet.
- Replaced the silently-disabled empty state with a small explanatory hint
  ("No fields found. Open the upstream query in Query Manager and detect /
  save its Result Columns.") and a loading spinner while the Supabase read is
  in flight. The freeform `variableName::columnName` input remains available
  so the user is never fully blocked.

## Notes
- Uses the existing `CustomDropdown` in the picker's expanded state — no new
  dropdown UI was added.
- No new edit / date-picker widgets were introduced; existing pencil-icon
  buttons and the shared `DatePicker` component elsewhere in the panel are
  untouched.
- No schema changes — the fallback reads the existing
  `queries.last_known_columns` column directly.
