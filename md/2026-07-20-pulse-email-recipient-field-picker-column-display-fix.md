# Pulse Email Recipient Field Picker - Column Name Display Fix

## Summary

Fixed the `{ }` field picker dropdown in the Pulse Email step To/CC/BCC fields to display only clean column names (e.g., `ID`, `PURPOSE`, `EMAILS`) instead of raw JSON objects like `{"name":"ID","type":"INTEGER"}`.

## Root Cause

The `last_known_columns` field in the `queries` table can store either plain strings or objects with `{name, type}` shape. The original implementation cast the array as `string[]` directly, which caused the raw JSON representation to appear in the dropdown when the data was stored as objects.

## Changes

### `src/pages/PulseBuilder/panels/EmailConfigPanel.tsx`

- Updated the column parsing logic in the `recipientColumns` fetch effect to handle both formats:
  - Plain strings pass through directly.
  - Objects with a `name` property have the name extracted.
- The dropdown now displays only the clean field names.
