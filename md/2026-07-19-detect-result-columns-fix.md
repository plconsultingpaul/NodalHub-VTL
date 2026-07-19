# 2026-07-19 Detect Result Columns Fix

## Problem

The "Detect" button in the Nodal Connect query form was silently failing to retrieve result columns from the API. The `POST /executables/manage/detect-result-columns` endpoint requires `inputs` (test parameter values) when the query contains parameters, and errors were swallowed by a silent `catch` block.

## Changes

### `src/pages/QueryManager/NodalConnectQueryForm.tsx`

1. **Added `resultColumnsError` state** to surface API errors visibly in the UI
2. **Pass `inputs` to the detect-result-columns request** - after parameters are detected, their names are sent as empty-string test values so the API can execute the query to discover columns
3. **Added `console.log`/`console.warn`/`console.error` logging** for the request URL, body, response status, and response data so failures are visible in the browser console
4. **Handle non-success responses** - if the API returns `success: false` or a non-200 status, the error message is extracted and displayed
5. **Show error in UI** - a red error line appears above the Result Columns list when detection fails

## How It Works Now

1. User clicks "Detect" in Parameters
2. `detect-params` is called first (unchanged)
3. After params are detected, `detect-result-columns` is called with:
   - `executableType`: SQL_QUERY or STORED_PROCEDURE
   - `sqlQueryText` or `procName`
   - `dbConnectionId`
   - `inputs`: `{ paramName: "" }` for each detected parameter
4. Response is logged to the browser console regardless of outcome
5. On success: columns populate the Result Columns section
6. On failure: error message is shown in red below the Result Columns header
