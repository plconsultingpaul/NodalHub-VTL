# Drilldown Column Resize/Move Fix

**Date:** 2026-01-08

## Problem

Users were unable to resize or move columns in drilldown tables. The cursor showed the resize indicator, but dragging had no effect.

## Root Cause

The drilldown Tabulator is rendered inside a manually created `<tr>` element that gets inserted into the parent Tabulator's DOM structure. This creates a nested table scenario where the parent table's event handlers were intercepting pointer events before they could reach the drilldown table's resize handles.

## Solution

Two changes were made:

1. **CSS fixes** for pointer events:
   - Set `position: relative` on the `.inline-drilldown-row` container
   - Elevated z-index of the nested Tabulator and its header
   - Explicitly enabled `pointer-events: auto` on column resize handles

2. **Layout change** from `fitDataFill` to `fitColumns`:
   - The original layout constrained the table to content width only
   - This left no room to resize the last column wider
   - `fitColumns` makes the table fill available width, allowing all columns to be resized

## Files Changed

- `src/index.css` - Added CSS rules for `.inline-drilldown-row` and nested Tabulator elements
- `src/pages/DashboardViewer/DashboardCell.tsx` - Changed drilldown Tabulator layout to `fitColumns`
