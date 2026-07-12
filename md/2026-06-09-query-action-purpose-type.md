# Query vs Action Purpose Type

**Date:** 2026-06-09

## Summary

Added a `purpose_type` field to queries that distinguishes between "Query" (data retrieval) and "Action" (data mutation/trigger) types.

## Changes

### Database Migration
- Added `purpose_type` column (`text NOT NULL DEFAULT 'query'`) to the `queries` table.
- Added CHECK constraint: `purpose_type IN ('query', 'action')`.
- Added index `idx_queries_purpose_type` for efficient filtering.
- All existing records default to `'query'`.

### TypeScript Types (`src/types/database.ts`)
- Added `purpose_type: 'query' | 'action'` to Row, Insert, and Update interfaces for `queries`.
- Exported new type alias: `QueryPurposeType = 'query' | 'action'`.

### Query Form (`src/pages/QueryManager/ApiEndpointQueryForm.tsx`)
- Added a "Type" dropdown (using `CustomDropdown`) below the Query Name field.
- Options: "Query" and "Action". Defaults to "Query".
- Value is persisted via `purpose_type` in the save payload.

### Query Manager Index (`src/pages/QueryManager/index.tsx`)
- Added a filter dropdown in the toolbar: "All Types" / "Queries" / "Actions".
- Added a "Purpose" column to the grid showing a color-coded badge:
  - Query: sky/blue badge
  - Action: amber/orange badge
- Grid now renders `filteredQueries` based on the selected filter.

### useQueries Hook (`src/hooks/useQueries.ts`)
- No changes needed. The hook already spreads all query fields for insert/update and fetches `*` (all columns), so `purpose_type` flows through automatically.

## Files Modified
- `supabase/migrations/20260609_add_purpose_type_to_queries.sql` (new)
- `src/types/database.ts`
- `src/pages/QueryManager/ApiEndpointQueryForm.tsx`
- `src/pages/QueryManager/index.tsx`
