# Column Resize Performance Fix

**Date:** 2026-01-15

## Problem

When resizing columns in the dashboard grid (Tabulator), the browser would freeze or crash. The application became unresponsive during column drag operations with large datasets (e.g., 39 columns x 108 rows).

## Root Causes

Three issues contributed to the problem:

1. **Tabulator's default `resizableColumnFit` behavior**: When enabled (the default), Tabulator recalculates the widths of ALL other columns whenever any single column is resized. With 39 columns, this triggers expensive layout recalculations on every pixel of mouse movement.

2. **Unbounced event handlers**: The `columnResized` event fires continuously during drag operations (60+ times per second). Each event was calling `onColumnChange()` which updated React state unnecessarily.

3. **Unstable useEffect dependency**: The `drilldownAvailability` state was in the Tabulator initialization useEffect dependencies. Since this state changes after data loads, it would destroy and recreate the entire Tabulator instance - causing crashes when interacting with the grid during/after resize.

## Solution

### Fix 1: Disable Column Fit Recalculation

Added `resizableColumnFit: false` to make each column resize independently.

```typescript
tabulatorRef.current = new Tabulator(tableRef.current, {
  resizableColumns: true,
  resizableColumnFit: false,
});
```

### Fix 2: Debounced Event Handlers

Added 150ms debounce to prevent excessive state updates during resize.

```typescript
const debouncedColumnChange = useCallback(() => {
  if (columnChangeDebounceRef.current) {
    clearTimeout(columnChangeDebounceRef.current);
  }
  columnChangeDebounceRef.current = setTimeout(() => {
    onColumnChangeRef.current?.();
  }, 150);
}, []);
```

### Fix 3: Remove Unstable Dependency

Removed `drilldownAvailability` from the Tabulator useEffect dependencies. The ref (`drilldownAvailabilityRef`) is used inside formatters instead, and a separate lightweight useEffect handles row reformatting when availability changes.

```typescript
// Before: Would destroy/recreate Tabulator when drilldownAvailability changed
}, [data, hasDrilldowns, ..., drilldownAvailability, debouncedColumnChange]);

// After: Tabulator is stable, only recreated when data/template changes
}, [data, hasDrilldowns, ..., debouncedColumnChange]);

// Separate effect for reformatting rows when drilldown availability changes
useEffect(() => {
  if (!tabulatorRef.current || !hasDrilldowns) return;
  tabulatorRef.current.getRows().forEach(row => row.reformat());
}, [drilldownAvailability, hasDrilldowns]);
```

## Changes Made

**File:** `src/pages/DashboardViewer/DashboardCell.tsx`

1. Added `resizableColumnFit: false` to main Tabulator initialization
2. Added debounced column change handler with 150ms delay
3. Removed `drilldownAvailability` from main useEffect dependencies
4. Added separate useEffect to reformat rows when drilldown availability changes
5. Added cleanup for debounce timeout on unmount

## Impact

- Column resize operations are now smooth and responsive
- Grid remains stable during and after resize operations
- Clicking in the grid after resize no longer causes crashes
- Drilldown icons still update correctly when availability is determined
