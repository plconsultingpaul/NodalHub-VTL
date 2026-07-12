# Drilldown Existence Indicator Feature

**Date:** 2026-01-08

## Summary

Added functionality to check if drilldown data exists for each row in a dashboard cell before showing the expand icon. This allows users to immediately see which parent records have drill-down data available.

## Changes Made

### File: `src/pages/DashboardViewer/DashboardCell.tsx`

1. **Added `drilldownAvailability` state** - A Set that tracks which row indices have drilldown data available.

2. **Added `drilldownAvailabilityRef`** - A ref to access current drilldown availability in the Tabulator formatter.

3. **Added `checkDrilldownExistence` function** - After parent data loads, this function:
   - Iterates through each configured drilldown
   - Gets the mapped field from parameter_mappings or link_field
   - For each parent row, executes the drilldown query
   - If results are returned, adds the row index to the availability Set
   - Logs progress for debugging

4. **Updated `fetchData`** - Now calls `checkDrilldownExistence` after successfully loading parent data.

5. **Updated expand column formatter** - Only renders the expand/chevron icon for rows that have drilldown data available. Rows without data show an empty placeholder.

6. **Updated expand column click handler** - Ignores clicks on rows without drilldown data.

7. **Added `drilldownAvailability` to Tabulator useEffect dependencies** - Ensures grid re-renders when availability changes.

## Behavior

- When a dashboard cell loads with drilldowns configured:
  1. Parent query executes and displays data
  2. For each row, the drilldown query is executed to check for data existence
  3. Rows with drilldown data show an expand icon (chevron)
  4. Rows without drilldown data show no icon
  5. Clicking the expand icon fetches and displays drilldown results

## Console Logging

Debug logging has been added with `[DashboardCell]` prefix:
- Drilldown existence check start and row count
- Which drilldown is being checked and the mapped field
- Which rows have drilldown data
- Final list of rows with available drilldowns
