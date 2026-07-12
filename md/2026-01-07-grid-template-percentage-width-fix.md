# Grid Template Column Width Fix - Percentage-Based Storage

**Date:** 2026-01-07

## Problem

When a user stretched a column (e.g., DriverId) very wide and saved the grid template, then reopened the template, the last column (CellPhone) would wrap to a second row. Column headers should never wrap to multiple rows.

## Root Cause

The `getColumnConfig()` function was saving column widths as absolute pixel values. When the template was reapplied, these large pixel widths (e.g., 500px for DriverId) would force other columns to squeeze or overflow beyond the container width, causing unwanted wrapping.

## Solution

Changed column width storage from absolute pixels to percentages:

1. **Saving templates:** `getColumnConfig()` now calculates each column's width as a percentage of the container width instead of storing raw pixel values.

2. **Applying templates:** Column widths are now applied as percentage strings (e.g., `"25%"`) instead of pixel numbers, ensuring columns always fit proportionally within the container regardless of screen size.

## Files Changed

- `src/pages/DashboardViewer/DashboardCell.tsx`
  - Modified `getColumnConfig()` to calculate percentage widths based on container width
  - Modified column definition to apply widths as percentage strings

## Technical Details

```typescript
// Before: Stored pixel width
width: col.getWidth()

// After: Store percentage of container
const containerWidth = tableRef.current.clientWidth;
const percentWidth = Math.round((pixelWidth / containerWidth) * 100);

// Applied as percentage string
width: tc?.width ? `${tc.width}%` : undefined
```

This ensures that no matter how wide a user makes one column, all columns will proportionally fit within the available container space when the template is reloaded.

---

## Follow-up Fix: Backwards Compatibility

**Date:** 2026-01-07

### Issue

Grids displayed in a broken vertical card layout instead of the expected horizontal table format after the percentage-based width feature was implemented.

### Root Cause

Existing saved grid templates had pixel-based width values stored (e.g., 200, 300 pixels). The percentage-based width change was interpreting these legacy pixel values as percentages (200%, 300%), causing columns to become enormously wide and triggering Tabulator's responsive collapse mode.

### Solution

Added a check to detect legacy pixel values vs new percentage values:
- If `width > 100`, it's a legacy pixel value (no column can exceed 100% of the container) - ignore it and let `fitColumns` auto-size
- If `width <= 100`, treat it as a valid percentage and apply it

### Code Change

```typescript
// Before
width: tc?.width ? `${tc.width}%` : undefined,

// After
width: tc?.width && tc.width <= 100 ? `${tc.width}%` : undefined,
```

### Result

- Legacy templates with pixel-based widths continue to work (auto-sized by fitColumns)
- New templates saved with percentage widths work correctly
- Backwards compatibility maintained
