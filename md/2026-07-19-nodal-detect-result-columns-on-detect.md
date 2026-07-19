# 2026-07-19 Nodal Connect Detect Result Columns

## Summary

Enhanced the "Detect" button in the Nodal Connect Query form to also detect result columns from the upstream SQL query. These columns are then stored on the query record and made available to the Pulse Workflow Action step field picker.

## Changes

### Modified Files

- **`src/pages/QueryManager/NodalConnectQueryForm.tsx`**
  - Added `resultColumns` state initialized from the query's existing `last_known_columns`
  - Modified `handleDetectParams` to also call `POST /executables/manage/detect-result-columns` after detecting parameters (best-effort, non-blocking if it fails)
  - Added `last_known_columns: resultColumns` to the save payload so columns persist immediately on save
  - Added a "Result Columns" display section below Parameters showing the detected column names as chips (or a hint to use Detect if none are available yet)

## How It Works

1. User clicks "Detect" in the Parameters section of a Nodal Connect query
2. The system calls `detect-params` (existing) AND `detect-result-columns` (new) in sequence
3. The `DetectResultColumnsRequest` is sent with `executableType`, `sqlQueryText`/`procName`, and `dbConnectionId`
4. The response contains `{ success, columns: [{ name, type }] }` -- column names are extracted and stored in state
5. When the query is saved, `last_known_columns` is included in the save payload
6. In the Pulse Workflow, the Action step's Query Field picker reads `last_known_columns` from the query record to populate the field dropdown

## API Endpoint Used

`POST /executables/manage/detect-result-columns`

Request body (DetectResultColumnsRequest):
```json
{
  "executableType": "SQL_QUERY" | "STORED_PROCEDURE",
  "sqlQueryText": "SELECT ...",
  "dbConnectionId": "uuid",
  "procName": "optional"
}
```

Response (DetectResultColumnsResponse):
```json
{
  "success": true,
  "columns": [{ "name": "COLUMN_NAME", "type": "VARCHAR" }]
}
```
