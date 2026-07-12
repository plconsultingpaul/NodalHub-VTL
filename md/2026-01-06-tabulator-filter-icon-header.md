# Tabulator Filter Icon in Column Header

**Date:** 2026-01-06

## Summary

Column headers now display everything on a single line: column name, sort arrows, and filter icon.

## Changes Made

### File: `src/pages/DashboardViewer/DashboardCell.tsx`

1. Replaced `headerFilter` approach with custom `titleFormatter`
2. All elements now on same line: [Column Name] [Sort Arrow] [Filter Icon]
3. Removed the separate header filter row
4. Filter icon positioned at the right edge of each column header
5. Filter dropdown uses `position: fixed` and appends to document body to prevent z-index clipping
6. Filter state managed via module-level Maps for persistence during interactions

## Layout

Single header row containing:
- Column title (left-aligned, flexible width)
- Sort indicator (managed by Tabulator automatically)
- Filter icon button (right-aligned, fixed size)

## Behavior

- Click column header area to sort (Tabulator default)
- Click filter icon to open multi-select dropdown
- Filter icon turns blue when filter is active
- Dropdown displays above all content (fixed positioning)
- Click outside to close dropdown
