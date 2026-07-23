# Pulse Email Results Table - Corrupted Column Config Sanitizer

**Date:** 2026-07-23

## Problem

When running a Pulse workflow with an email step containing a `{results_table}`, the email rendered column metadata fragments (`{"name":"DRIVER_ID", "type":"STRING"}`) as table content instead of actual data rows, despite `flattenRows` correctly extracting 266 rows with proper keys.

## Root Cause

The `resultsTableColumns` stored in the pulse's `step_configs` was corrupted -- it contained fragmented JSON object strings like:

```json
["[{\"name\":\"DRIVER_ID\"", "\"type\":\"STRING\"}", "{\"name\":\"NAME\"", ...]
```

This originated from a historical bug where `last_known_columns` on the query stored raw `{name, type}` metadata objects. The Pulse email config was saved during that period, capturing the corrupted values. Although `last_known_columns` was later fixed (now properly `["DRIVER_ID","NAME","PHONE","DRIVER_TYPE"]`), the pulse config still held the old corrupted data.

When `buildHtmlTable` received these fragments as column keys, it used them as headers and tried `row["[{\"name\":\"DRIVER_ID\""]` for cell values (returning `undefined`).

## Fix

Added a `sanitizeTableColumns` function in `supabase/functions/pulse-runner/index.ts` that:

1. Detects if column entries look corrupted (contain `"name":` patterns or start with `[{`/`{"`)
2. Attempts to parse by joining fragments and parsing as JSON array of `{name}` objects
3. Falls back to regex extraction of `"name":"VALUE"` patterns
4. Final fallback: uses actual row keys from the data (which are always correct)

Applied the sanitizer in both the V2 workflow email step and the V1 legacy email path.

## Files Changed

- `supabase/functions/pulse-runner/index.ts` -- Added `sanitizeTableColumns` function, applied to both V1 and V2 email table column resolution
