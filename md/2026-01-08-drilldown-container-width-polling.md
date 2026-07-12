# Drilldown Container Width Polling Fix

**Date:** 2026-01-08

## Problem

Drilldown grids were not loading saved column widths from templates. The percentage-to-pixel conversion was failing because the container had 0 width when the conversion was attempted.

Console logs showed:
```
Container width after layout: 0
Converting cell: 32% -> 0px
Converting name: 28% -> 0px
Converting email: 40% -> 0px
```

## Cause

The single `requestAnimationFrame` was firing before the container element had been laid out by the browser and received its actual dimensions.

## Solution

Replaced the single `requestAnimationFrame` with a polling mechanism that:
1. Checks if the container has a non-zero width
2. If width is 0, retries after 20ms (up to 10 attempts)
3. Only initializes the Tabulator once the container has actual dimensions

## File Changed

- `src/pages/DashboardViewer/DashboardCell.tsx`

## Code Change

Wrapped the Tabulator initialization in an `initTabulator` function that polls for container width before converting percentages to pixels and creating the table.
