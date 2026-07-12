# Tri-State Sort Arrow Indicators

**Date:** 2026-01-08

## Summary

Restored sort arrow indicators after the manual tri-state sort handler was implemented. The previous fix disabled Tabulator's native `headerSort`, which also removed the visual sort direction arrows.

## Changes Made

### DashboardCell.tsx

1. **Added SVG icon constants** for sort arrows (14x14 pixels):
   - `SORT_ASC_SVG` - Up arrow triangle for ascending sort
   - `SORT_DESC_SVG` - Down arrow triangle for descending sort

2. **Added sort indicator element** in `createTitleWithFilter`:
   - Created a `sortIndicator` span element positioned after the title text
   - Blue color (#2563eb) when active, gray when inactive

3. **Added `updateSortIndicator` function**:
   - Shows up arrow for ascending sort
   - Shows down arrow for descending sort
   - Clears indicator when sort is removed (third click)

4. **Added `updateAllSortIndicators` function**:
   - Clears sort indicators from other columns when a new column is sorted
   - Ensures only one column shows the sort indicator at a time

5. **Updated click handler**:
   - Calls `updateSortIndicator` after changing sort state
   - Calls `updateAllSortIndicators` to clear other columns

## Behavior

- **First click**: Shows up arrow (ascending)
- **Second click**: Shows down arrow (descending)
- **Third click**: Clears arrow (no sort)
