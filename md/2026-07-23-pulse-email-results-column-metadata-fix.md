# Pulse Workflow Email Results - Column Metadata Fix

**Date:** 2026-07-23

## Problem

When running a Pulse workflow that includes an email step with a results table, the email was rendering column metadata (`{"name":"DRIVER_ID", "type":"STRING"}`) as table data instead of the actual row values. The Query Manager test button displayed results correctly, but the Pulse email did not.

## Root Cause

The `flattenRows` function in `supabase/functions/pulse-runner/index.ts` extracts tabular data from API responses by finding the first array property whose first element is an object.

For Nodal Connect SQL responses, the format is:
```json
{
  "columns": [{"name": "DRIVER_ID", "type": "STRING"}, ...],
  "data": [["ABOMOH", "ABOUZAR, MOHSEN", "514-771-3759", "C"], ...]
}
```

The function found `columns` first (an array of objects) and returned that as the "rows," causing the email to display column definitions instead of actual data.

Additionally, the generic fallback treated JavaScript arrays (`data: [[...], ...]`) as valid "object" rows since `typeof [] === "object"`, which would cause further issues even if `columns` was skipped.

## Fix

In `supabase/functions/pulse-runner/index.ts`:

1. **Added `columns` + `data` pattern detection** at the top of `flattenRows`: When both `columns` (array of `{name}` objects) and `data` (array of arrays) exist, zip them together into proper row objects using column names as keys.

2. **Added `!Array.isArray()` guards** in the generic iteration loop to prevent inner arrays from being mistaken for row objects.

3. **Added diagnostic logging** to the V2 email step so future issues with data extraction are immediately visible in edge function logs (shows sourceData shape, keys, and what flattenRows returns).

## Files Changed

- `supabase/functions/pulse-runner/index.ts` — Fixed `flattenRows` function + added email step logging
