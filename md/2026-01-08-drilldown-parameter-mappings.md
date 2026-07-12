# Drilldown Parameter Mappings Feature

**Date:** 2026-01-08

## Overview

Added the ability to map parent row fields to drilldown query User Parameters when configuring drill-down queries in the Cell Configuration panel.

## Problem

When a drilldown query has User Parameters with `Target = Path` (like `@vendorId` for a URL path `vendors/{vendorId}/contacts`), there was no way to specify which field from the parent row should be passed into those parameters.

## Solution

### Database Changes

- Added `parameter_mappings` JSONB column to `dashboard_cell_drilldowns` table
- Format: `{"parameterName": "parentFieldName"}`
- Example: `{"vendorId": "id"}` means pass the parent row's `id` field value to the drilldown's `@vendorId` parameter

### UI Changes (CellConfigPanel)

- When a drilldown query is selected, the system checks if that query has User Parameters with `target = 'path'`
- If path parameters exist, displays a "Parameter Mappings" section instead of the generic "Link Field" input
- Each path parameter shows a dropdown to select which parent query field to map to it
- If no path parameters exist, falls back to the original "Link Field" input behavior

### Runtime Changes (DashboardCell)

- `executeQuery` function now accepts optional `parameterMappings` and `rowData` parameters
- When parameter mappings are provided, the mapped field values from the row are injected into the query parameters before execution
- `fetchDrilldown` and `toggleRow` functions updated to pass the mappings through

## Files Modified

1. `supabase/migrations/20260108_add_parameter_mappings_to_drilldowns.sql` - Database migration
2. `src/types/database.ts` - Added parameter_mappings to drilldown types
3. `src/pages/DashboardBuilder/CellConfigPanel.tsx` - Added dynamic parameter mapping UI with field fetching from api_endpoint_fields
4. `src/pages/DashboardBuilder/index.tsx` - Updated DrilldownConfig interface and initialization
5. `src/hooks/useDashboardConfig.ts` - Updated save function to persist parameter_mappings
6. `src/pages/DashboardViewer/DashboardCell.tsx` - Updated query execution to use parameter mappings

## Technical Notes

- Parent field dropdown fetches actual response field names from the `api_endpoint_fields` table based on the parent query's `api_spec_endpoint_id`
- Fields are sorted alphabetically for easier selection

## Usage Example

1. Create a Query with a path parameter (e.g., API Sub-path: `vendors/{vendorId}/contacts`)
2. Add a User Parameter named `@vendorId` with `Target = Path`
3. In Dashboard Builder, configure a cell with a parent query (e.g., "Vendors" query that returns vendor data with an `id` field)
4. Add a Drill-Down Query and select your "Vendor Contacts" query
5. The UI will show "Parameter Mappings" section with `@vendorId` parameter
6. Select `id` from the dropdown to map the parent's `id` field to the `@vendorId` parameter
7. Save the configuration
8. When viewing the dashboard and expanding a row, the drilldown will fetch contacts for that specific vendor using the row's `id` value
