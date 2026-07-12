# Tabulator Tri-State Column Sorting

**Date:** 2026-01-08

## Summary

Added tri-state sorting behavior to column headers in the grid. Previously, clicking a column header would cycle between ascending and descending sort only. Now it cycles through ascending, descending, and no sort (returns to default order).

## Change

Added `headerSortTristate: true` option to the Tabulator configuration in `DashboardCell.tsx`.

## File Modified

- `src/pages/DashboardViewer/DashboardCell.tsx` (line 1745)

## Behavior

- First click: Sort ascending
- Second click: Sort descending
- Third click: Clear sort (return to default order)
