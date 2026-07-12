# Drilldown Grid Layout Templates

**Date:** 2026-01-08

## Summary

Added the ability to customize and persist drilldown grid layouts. Users can now modify column positions and widths in drilldown tables, and these settings are automatically saved for future use.

## Changes Made

### Database

- Added `column_config` JSONB column to `dashboard_cell_drilldowns` table
- Stores column configuration including field name, position, width (percentage), and title

### Type Definitions

- Updated `dashboard_cell_drilldowns` Row, Insert, and Update types to include `column_config` field

### DashboardCell Component

- Replaced simple HTML tables with Tabulator instances for drilldown grids
- Enabled `movableColumns` and `resizableColumns` on drilldown Tabulators
- Added `saveDrilldownColumnConfig` function to persist layout changes
- Column move/resize events automatically save configuration to database
- Drilldown grids now load with saved column order and widths
- Added proper cleanup of Tabulator instances when drilldowns collapse

## How It Works

1. When a drilldown expands, it checks for saved `column_config` on the drilldown record
2. If configuration exists, columns are sorted by saved position and widths applied
3. Users can drag columns to reorder or resize them
4. On column move or resize, the new configuration is automatically saved
5. Next time the drilldown opens, it uses the saved layout

## Files Modified

- `supabase/migrations/20260108_add_column_config_to_drilldowns.sql`
- `src/types/database.ts`
- `src/pages/DashboardViewer/DashboardCell.tsx`
