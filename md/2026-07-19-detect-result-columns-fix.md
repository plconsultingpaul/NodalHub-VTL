# 2026-07-19 Detect Result Columns Fix

## Problem

The "Detect" button in the Nodal Connect query form failed to retrieve result columns from the API. The error was:

```
Detection failed: Connection not found: VTL
```

The `POST /executables/manage/detect-result-columns` endpoint requires a valid `dbConnectionId` that matches a connection registered on the Nodal Connect server. The value stored in our database (`VTL`) was not recognized by that server's connection registry.

## Solution

Switched to the `PUT /executables/manage/{name}/detect-result-columns` variant. This endpoint operates on an **already-saved executable** and uses the database connection already configured on it -- avoiding the connection lookup entirely.

## Changes

### `src/pages/QueryManager/NodalConnectQueryForm.tsx`

1. **Detect button (handleDetectParams):**
   - For existing queries (edit mode): uses `PUT /executables/manage/{name}/detect-result-columns` with empty test inputs, leveraging the connection already stored on the executable
   - For new queries (create mode): shows informational message that columns will be detected after first save
   - Added `resultColumnsError` state for visible error feedback
   - Console logging for debugging

2. **Post-save detection (detectResultColumns):**
   - Simplified to always use the PUT variant since the executable is guaranteed to exist at this point
   - Passes empty inputs for parameters
   - Parses both string (`"COL1,COL2"`) and array response formats
   - Updates local state and persists to `last_known_columns` in the database
   - Console logging for debugging

## API Endpoints Used

- **Before (broken):** `POST /executables/manage/detect-result-columns` -- requires `dbConnectionId` to match server config
- **After (working):** `PUT /executables/manage/{name}/detect-result-columns` -- uses the connection already saved on the executable
