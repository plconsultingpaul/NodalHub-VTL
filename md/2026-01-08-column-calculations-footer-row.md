# Column Calculations Footer Row

**Date:** 2026-01-08

## Summary

Changed column calculations (Sum, Average, Count, Min, Max) to display in Tabulator's native footer row directly beneath each column, instead of in a separate status bar at the bottom of the cell.

## Changes Made

### DashboardCell.tsx

1. **Added `bottomCalc` to column definitions**:
   - When a calculation is selected via the sigma icon menu, the column definition includes `bottomCalc` (e.g., `bottomCalc: "sum"`)
   - Uses Tabulator's built-in calculation types: sum, avg, count, min, max

2. **Added `bottomCalcFormatter` for display formatting**:
   - Formats the calculation result with a label (e.g., "Sum = 136,371.00")
   - Count displays as integer, other calculations display with 2 decimal places and locale formatting

3. **Separate useEffect for calculation updates**:
   - Uses `updateColumnDefinition()` to dynamically add/remove bottomCalc without rebuilding the entire table
   - Prevents flickering by not including `calcUpdateTrigger` in the main Tabulator useEffect
   - Removed the `dataFiltered` event handler that was calling `notifyCalcUpdate()` since Tabulator's bottomCalc automatically recalculates on filter

4. **Removed the separate footer bar**:
   - Removed the `computeCalculations` function
   - Removed the footer bar JSX that displayed calculations in a separate row

## Behavior

- User clicks the sigma icon on a column header
- Selects a calculation type (Sum, Average, Count, Min, Max)
- The calculation result appears in a frozen footer row directly beneath that column
- Format: "Sum = 136,371.00" or "Count = 14"
- Multiple columns can have calculations simultaneously
- Calculations update automatically when data is filtered
