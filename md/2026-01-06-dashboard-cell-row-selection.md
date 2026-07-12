# Dashboard Cell Row Selection Feature

Date: 2026-01-06

## Summary

Added an option in the Cell Configuration modal to enable row selection checkboxes in dashboard cells.

## Changes Made

### Database Migration
- Added `enable_row_selection` boolean column to `dashboard_cells` table with default value of `false`

### src/types/database.ts
- Added `enable_row_selection: boolean` to DashboardCell Row, Insert, and Update types

### src/pages/DashboardBuilder/CellConfigPanel.tsx
- Added `enable_row_selection` to CellConfig interface
- Added checkbox toggle UI between Row/Column Span and Drill-Down Queries sections

### src/pages/DashboardBuilder/index.tsx
- Added `enable_row_selection` to CellConfig interface
- Updated all cell initialization locations to include `enable_row_selection: false`
- Updated cell loading from database to include `enable_row_selection`

### src/hooks/useDashboardConfig.ts
- Added `enable_row_selection` to saveCellsLayout parameter type
- Updated cellData object to include `enable_row_selection` when saving

### src/pages/DashboardViewer/DashboardCell.tsx
- Added row selection column as first column when `enable_row_selection` is true
- Uses Tabulator's built-in `rowSelection` formatter for checkboxes
- Added `selectable` option to Tabulator configuration
- Added `cell.enable_row_selection` to useEffect dependency array

## Notes

- The row selection checkboxes are visual only at this time
- Functionality for acting on selected rows will be added in a future update
