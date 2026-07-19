# 2026-07-19 Action Step Query Field Picker Fix

## Problem

The `{ }` Query Field button in the Pulse Workflow Action Config Panel showed no columns, even though the upstream query had Result Columns populated via "Detect" in the Query Manager.

**Root cause:** The `last_known_columns` for "Temp Controlled Shipping Instruc" was stored as malformed data -- the raw JSON response string `[{"name":"DETAIL_LINE_ID","type":"INTEGER"}]` had been split on commas and stored as individual garbage array elements (`["[{\"name\":\"DETAIL_LINE_ID\"", "\"type\":\"INTEGER\"}]"]`). The code consuming `last_known_columns` had no defense against this format and silently produced empty column lists.

## Changes

### `src/pages/PulseBuilder/panels/ActionConfigPanel.tsx`

- **`upstreamColumnOptions` memo (line ~258):** Added normalization when reading `last_known_columns`. Each element is checked: plain strings are kept as-is, objects with a `.name` property are unwrapped, and garbage fragments (starting with `[`, `{`, or `"`) are filtered out.

### `src/pages/QueryManager/NodalConnectQueryForm.tsx`

- **`resultColumns` state initializer (line ~100):** Same normalization applied when loading `query?.last_known_columns` into local state, so the Result Columns display always shows clean column names regardless of how the data was stored.

### Database

- Fixed the corrupted `last_known_columns` value on "Temp Controlled Shipping Instruc" from `["[{\"name\":\"DETAIL_LINE_ID\"", "\"type\":\"INTEGER\"}]"]` to `["DETAIL_LINE_ID"]`.
