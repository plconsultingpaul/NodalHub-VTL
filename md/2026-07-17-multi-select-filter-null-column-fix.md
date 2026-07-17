# 2026-07-17 Multi-Select Filter Null Column Fix

## Problem

When using the multi-select header filter on a dashboard grid column that contains blank/null values, selecting any value would show 0 records instead of filtering to matching rows.

## Root Cause

The `getUniqueValues()` function converts all cell values to strings for display in the dropdown (e.g., the number `73579` becomes the string `"73579"`).

When the user selects a value, the code was using Tabulator's built-in `'in'` filter:
```ts
table.addFilter(field, 'in', realValues);
```

Tabulator's `'in'` filter uses strict equality. Since `realValues` contains strings but the actual row data contains numbers, `73579 !== "73579"` and no rows matched.

This only surfaced on columns with blanks because:
- The blank sentinel entry in the dropdown causes `selectedValues.size < allValues.length` to be true even when all real values are checked
- This triggers the filter path that would otherwise be skipped (when all values are selected, no filter is applied)

## Fix

Replaced the built-in `table.addFilter(field, 'in', realValues)` with a custom filter function that coerces cell values to strings before comparison -- matching how values were originally collected:

```ts
const filterFunc = (data: Record<string, unknown>) => {
  const cellValue = data[field];
  if (cellValue === null || cellValue === undefined || cellValue === '') return false;
  return realValues.includes(String(cellValue));
};
```

## Files Changed

- `src/pages/DashboardViewer/DashboardCell.tsx` -- replaced built-in `'in'` filter with custom string-coercing filter function in the `applyFilter()` logic
