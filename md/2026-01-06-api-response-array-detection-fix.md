# API Response Array Detection Fix

**Date:** 2026-01-06

## Summary

Added fallback logic to automatically detect array data in API responses with arbitrary property names.

## Problem

API responses that returned arrays under custom property names (e.g., `{ drivers: [...] }`, `{ orders: [...] }`) were not being extracted correctly. The code only checked for these specific property names:
- `data`
- `results`
- `items`
- `value`

Any other property name would cause the entire response object to be treated as a single-row array.

## Solution

Added a fallback that finds the first array property in the response object when none of the known property names match.

## Files Changed

### src/pages/DashboardViewer/DashboardCell.tsx
- Added fallback array property detection in `executeQuery` function (line 88-89)

### src/components/dashboard/TabulatorWidget.tsx
- Added fallback array property detection in `fetchData` function (line 88-93)

## Behavior

The array extraction now follows this priority:
1. Direct array response
2. `result.data`
3. `result.results`
4. `result.items`
5. `result.value`
6. First array property found in the response object (NEW)
7. Wrap the entire response as a single-item array
