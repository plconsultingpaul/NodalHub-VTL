# Drilldown Icon Toggle Fix

**Date:** 2026-01-08

## Issue

When clicking the drilldown expand button to collapse a row, the drilldown data was correctly removed but the icon remained in the expanded state (down arrow) instead of reverting to the collapsed state (right arrow).

## Cause

The Tabulator cell formatter correctly reads from `expandedRowsRef.current` to determine which icon to display, but the cell was not being re-rendered after the `toggleRow` function updated the state.

## Solution

Added a `setTimeout` with `tabulatorCell.getRow().reformat()` call after toggling the row state. The `setTimeout` ensures the state update completes before the reformat triggers, allowing the formatter to read the updated `expandedRowsRef` value and display the correct icon.

## File Changed

- `src/pages/DashboardViewer/DashboardCell.tsx`

## Code Change

In the `cellClick` handler for the `_expand` column, added row reformat after toggle:

```typescript
toggleRowRef.current?.(rowIndex, rowData);
setTimeout(() => {
  tabulatorCell.getRow().reformat();
}, 0);
```
