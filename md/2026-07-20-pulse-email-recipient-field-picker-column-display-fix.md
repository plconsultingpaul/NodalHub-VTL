# Pulse Email Recipient Field Picker - Column Display Fix

## Summary

Fixed the `{ }` field picker dropdown in the Pulse Email step so it correctly displays only clean column names (e.g., `ID`, `PURPOSE`, `EMAILS`) instead of showing raw malformed JSON fragments.

## Root Cause

The `last_known_columns` field in the `queries` table has two storage formats:

1. **Clean**: `["COL_A", "COL_B"]` -- plain string array of column names
2. **Corrupted fragments**: The JSON `[{"name":"ID","type":"INTEGER"},...]` was split on commas and stored as individual text array elements like `["[{\"name\":\"ID\"", "\"type\":\"INTEGER\"}", ...]`

The original code assumed the data was always either plain strings or proper JSON objects. The corrupted fragment format caused the dropdown to display the raw broken text.

## Changes

### `src/pages/PulseBuilder/panels/EmailConfigPanel.tsx`

- Rewrote the column parsing logic in the `recipientColumns` fetch effect to detect which format is present:
  - If the first element starts with `[` or contains `"name"`, the fragments are rejoined with commas and parsed as JSON to extract `.name` values.
  - If JSON parsing fails, a regex fallback extracts all `"name":"VALUE"` patterns.
  - Otherwise, plain strings are used directly.
- The dropdown now always shows clean column names regardless of storage format.
