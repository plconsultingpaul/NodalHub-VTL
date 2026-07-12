# Drilldown Template Column Width Fix

**Date:** 2026-01-08

## Problem

Drilldown grids were not respecting saved template column widths. When a template was saved with specific column widths, the drilldown tables would revert to auto-calculated widths based on data content (due to `fitData` layout behavior).

## Root Cause

The drilldown column definitions were using `widthGrow` to set column proportions, but with `fitData` layout, Tabulator calculates widths from data content and ignores `widthGrow` for initial sizing.

## Solution

When building drilldown column definitions, if a saved width exists in the template:
1. Set `width` as a percentage string (e.g., `"25%"`)
2. Set `widthGrow: 0` to prevent Tabulator from expanding the column
3. Set `widthShrink: 0` to prevent Tabulator from shrinking the column

This tells Tabulator to use the exact saved width without auto-adjustment, while still allowing manual resizing.

## Files Changed

- `src/pages/DashboardViewer/DashboardCell.tsx`
  - Modified the `renderInlineDrilldown` function's column definition builder
  - Changed from using `widthGrow` alone to using `width`, `widthGrow: 0`, and `widthShrink: 0` when a saved width exists
