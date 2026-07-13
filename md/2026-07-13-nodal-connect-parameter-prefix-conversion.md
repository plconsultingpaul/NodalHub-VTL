# NodalConnect Parameter Prefix Conversion (@ to :)

**Date:** 2026-07-13

## Summary

Fixed parameter prefix mismatch between the UI and the NodalConnect API. Users type `@ParameterName` in the SQL Query field (matching familiar SQL Server syntax), but NodalConnect expects `:ParameterName`. The conversion is now applied automatically when sending SQL to the API.

## Problem

- The Query Manager UI uses `@` as the parameter prefix (e.g. `@Status`, `@date`)
- NodalConnect expects `:` as the parameter prefix (e.g. `:Status`, `:date`)
- Previously the SQL text was sent to the API as-is, causing parameter detection and execution failures

## Fix

Applied `.replace(/@(\w+)/g, ':$1')` to `sqlText` in all 3 locations where it is sent to the NodalConnect API.

## File Changed

`src/pages/QueryManager/NodalConnectQueryForm.tsx`

### Location 1: `handleDetectParams` (parameter detection)

```ts
body.sqlQueryText = sqlText.replace(/@(\w+)/g, ':$1');
```

### Location 2: `handleSubmit` (create/update executable)

```ts
ncBody.sqlQueryText = sqlText.replace(/@(\w+)/g, ':$1');
```

### Location 3: `detectResultColumns` (column detection after save)

```ts
...(queryType === 'sql' ? { sqlQueryText: sqlText.replace(/@(\w+)/g, ':$1') } : { procName }),
```

## What stays the same

- The UI still shows `@ParameterName` syntax (unchanged user experience)
- The local database (`queries.sql_query_text`) still stores the `@` prefixed version
- The helper text still reads "Use @ParameterName syntax for parameters"
- The `paramDefinition` field already strips the `@` prefix correctly (sends bare names)
