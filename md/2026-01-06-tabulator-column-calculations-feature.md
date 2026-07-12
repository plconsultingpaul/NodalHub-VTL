# Tabulator Column Calculations Feature

**Date:** 2026-01-06

## Summary

Added column calculation functionality to the dashboard grid. Users can now select summary calculations (Sum, Average, Count, Minimum, Maximum) for any column, and the results are displayed in a footer below the table.

## Changes Made

### File: `src/pages/DashboardViewer/DashboardCell.tsx`

1. **Added Sigma Icon SVG**
   - New sigma (Σ) icon constant added for the calculation button

2. **Added Global State for Calculations**
   - `columnCalcState`: Map to track which calculations are enabled per column
   - Callback system (`registerCalcCallback`, `unregisterCalcCallback`, `notifyCalcUpdate`) to trigger re-renders when calculations change

3. **Enhanced Column Header**
   - Added sigma icon button to the right of the filter icon and clear icon
   - Clicking the sigma icon opens a dropdown with checkboxes for:
     - Average
     - Count
     - Maximum
     - Minimum
     - Sum
   - Icon highlights blue when calculations are active

4. **Calculation Footer**
   - New footer section displays below the table when calculations are selected
   - Shows calculation results in the format: "Field Name Calc Type = Value"
   - Values are formatted with commas and 2 decimal places (except Count)
   - Footer updates automatically when filters change

5. **Filter Integration**
   - Added `dataFiltered` event listener to Tabulator
   - Calculations recalculate based on visible (filtered) rows only

## User Workflow

1. Click the sigma (Σ) icon in any column header
2. Select desired calculations from the dropdown (multiple can be selected)
3. Click OK to confirm selections
4. View calculation results in the footer below the table
5. Apply filters - calculations update automatically to reflect filtered data
