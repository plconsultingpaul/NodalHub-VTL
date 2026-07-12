# Dashboard Resizable Cells Feature

**Date:** 2026-01-06

## Summary

Implemented a flexible, percentage-based cell layout system for the Dashboard Builder that allows cells to fill the page by default and be resized via drag handles.

## Changes Made

### Database Migration

Added new columns to `dashboard_cells` table:
- `width_percent` (numeric) - Width as percentage of the row (0-100)
- `height_percent` (numeric) - Height as percentage of total dashboard height (0-100)

### Dashboard Builder (`src/pages/DashboardBuilder/index.tsx`)

- **Default Behavior:** New dashboards now start with a single cell that fills 100% width and 100% height
- **Add Row:** Redistributes row heights equally among all rows (2 rows = 50% each, 3 rows = 33.3% each)
- **Split Cell:** Divides the selected cell's width in half, creating two side-by-side cells
- **Resize Handles:** Added draggable dividers between cells and rows:
  - Vertical dividers between cells in the same row (horizontal resize)
  - Horizontal dividers between rows (vertical resize)
- **Minimum Size:** Cells cannot be smaller than 10% to prevent collapse
- **Cell Deletion:** When deleting a cell, its space is redistributed to remaining cells in the row; when deleting the last cell in a row, the row is removed and heights are redistributed

### Dashboard Viewer (`src/pages/DashboardViewer/index.tsx`)

- Updated to use percentage-based layout matching the builder
- Cells render at their configured width and height percentages
- Removed fixed grid system in favor of flexible row-based layout

### Types (`src/types/database.ts`)

- Added `width_percent` and `height_percent` to the `dashboard_cells` type definition

### Hook (`src/hooks/useDashboardConfig.ts`)

- Updated `saveCellsLayout` function to persist `width_percent` and `height_percent` values

## Behavior Summary

| Action | Result |
|--------|--------|
| Create new dashboard | Single cell at 100% x 100% |
| Add Row | All rows redistribute to equal heights |
| Split Cell | Selected cell splits into two 50% width cells |
| Drag horizontal divider | Adjusts widths of adjacent cells |
| Drag vertical divider | Adjusts heights of adjacent rows |
| Delete cell in multi-cell row | Width redistributed to remaining cells |
| Delete last cell in row | Row removed, heights redistributed |

## Files Modified

- `supabase/migrations/[timestamp]_add_cell_percentage_columns.sql` (new)
- `src/types/database.ts`
- `src/pages/DashboardBuilder/index.tsx`
- `src/pages/DashboardViewer/index.tsx`
- `src/hooks/useDashboardConfig.ts`
