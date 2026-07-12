# Tri-State Column Sort Manual Handler Fix

**Date:** 2026-01-08

## Issue

The tri-state column sorting was not working correctly. Clicking a column header three times cycled ascending -> descending -> ascending instead of ascending -> descending -> none (unsorted).

The `headerSortTristate: true` Tabulator option was not functioning properly with the custom `titleFormatter` (`createTitleWithFilter`) that creates complex header elements.

## Solution

Implemented a manual tri-state sort handler on the title span element instead of relying on Tabulator's built-in tri-state functionality.

## Changes

### `src/pages/DashboardViewer/DashboardCell.tsx`

1. **Added sort state tracking map** (line 30):
   - `columnSortState: Map<string, 'none' | 'asc' | 'desc'>` - Tracks current sort state per column

2. **Added click handler on title span** (lines 84-106):
   - Cycles through: none -> asc -> desc -> none
   - Resets all other columns to 'none' when sorting a new column
   - Calls `table.setSort()` or `table.clearSort()` based on the state

3. **Disabled Tabulator's native header sort** (line 1756):
   - Changed `headerSort: true` to `headerSort: false` on data columns
   - Prevents conflict between native and manual sort handlers

4. **Removed `headerSortTristate: true`** from Tabulator options:
   - No longer needed since we handle sorting manually

## Behavior

- First click on column header: Ascending sort
- Second click: Descending sort
- Third click: Clears sort (returns to original order)
- Clicking a different column resets previous column's sort state
