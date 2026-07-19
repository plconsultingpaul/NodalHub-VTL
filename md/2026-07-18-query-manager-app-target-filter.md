# Query Manager Application Target (Dashboard/Pulse/Both)

**Date:** 2026-07-18

## Summary

Added a mandatory "Application" field to queries that specifies whether a query is intended for use in Dashboards, Pulses, or Both. The Dashboard Builder and Pulse Builder now only show relevant queries based on this field.

## Changes

### Database Migration
- Added `app_target` column to `queries` table (text, NOT NULL, default 'both')
- Added CHECK constraint: must be 'dashboard', 'pulse', or 'both'
- Added index `idx_queries_app_target` for performance
- Existing queries default to 'both' so they remain available everywhere

### `src/types/database.ts`
- Added `app_target: 'dashboard' | 'pulse' | 'both'` to Query Row, Insert, and Update types
- Exported new `QueryAppTarget` type

### `src/pages/QueryManager/NodalConnectQueryForm.tsx`
- Added mandatory "Application" CustomDropdown (Dashboard / Pulse / Both) next to Purpose Type
- Included `app_target` in saved query data

### `src/pages/QueryManager/ApiEndpointQueryForm.tsx`
- Added mandatory "Application" CustomDropdown (Dashboard / Pulse / Both) next to Type
- Included `app_target` in saved query data

### `src/pages/QueryManager/index.tsx`
- Added `appTargetFilter` state and "All Apps" filter dropdown in the header
- Updated `filteredQueries` to respect both purpose type and app target filters
- Added "Application" column header in the query table
- Added Application badge per query row (blue for Dashboard, green for Pulse, gray for Both)

### `src/pages/DashboardBuilder/CellConfigPanel.tsx`
- Filtered query dropdowns (main and drilldown) to only show queries with `app_target === 'dashboard'` or `app_target === 'both'`

### `src/pages/PulseBuilder/QueryTab.tsx`
- Filtered query dropdown to only show queries with `app_target === 'pulse'` or `app_target === 'both'`
