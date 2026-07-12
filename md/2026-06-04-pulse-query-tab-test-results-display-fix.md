# 2026-06-04 - Pulse Query Tab Test Results Display Fix

## Problem

When clicking "Test Query" in the Pulse Builder's Query tab, the results grid was showing API metadata (href, offset, limit, sort, filter, select, count) as a single row instead of the actual response data rows. The API returns a wrapper object like `{"href": "...", "offset": 0, "count": 111, "drivers": [...]}` and the grid was displaying the wrapper fields rather than the array of records nested inside it.

## Root Cause

The `flattenRows` function only checked for arrays under a hardcoded list of keys (`data`, `value`, `results`, `items`, `records`). When the API returns records under a dynamic key like `drivers`, none of those matched, causing it to fall back to wrapping the entire response object as a single row.

Additionally, the results table was collapsing to zero height due to `flex-1 min-h-0` layout in a parent with no explicit height.

## Changes

### `src/pages/PulseBuilder/QueryTab.tsx`

- Rewrote `flattenRows` to scan all keys of the response object for the first array of objects, instead of only checking a hardcoded list. This correctly extracts the `drivers` array (or any other entity name) from wrapper responses.
- If no array of objects is found in the response, returns an empty array (no longer wraps metadata as a fake row).
- Changed the outer container from `flex flex-col gap-6 h-full` to `space-y-6` so the results table renders naturally.
- Removed `flex-1 min-h-0` from the results table wrapper.
- Increased table scroll max-height from 320px to 480px.
- Fixed status indicator check from truthy to `!= null`.
