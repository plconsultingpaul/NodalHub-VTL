# Conditional Formatting - Trailing Space Fix

**Date:** 2026-07-13

## Problem

Conditional formatting rules were not applying background colors (or any formatting) to grid cells even though rules were correctly configured and saved.

## Root Cause

The NodalConnect API returns string values with trailing whitespace (e.g., `"True "` instead of `"True"`). The `evaluateCondition` function in `DashboardCell.tsx` was performing an exact string comparison after `.toLowerCase()`, but was not trimming whitespace. This caused `"true " === "true"` to evaluate as `false`, preventing the formatting rule from matching.

## Fix

Added `.trim()` to both `strCellValue` and `strCompareValue` in the `evaluateCondition` function so that trailing/leading whitespace from API responses does not break comparisons.

### File Changed

- `src/pages/DashboardViewer/DashboardCell.tsx`

### Code Change

```typescript
// Before
const strCellValue = String(cellValue ?? '');
const strCompareValue = String(compareValue ?? '');

// After
const strCellValue = String(cellValue ?? '').trim();
const strCompareValue = String(compareValue ?? '').trim();
```

This fix applies to all comparison types (Text, Numeric, Date) since the trim happens before the type-specific comparison logic branches.
