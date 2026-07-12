# Drilldown Column Width Storage - Pixel Values

**Date:** 2026-01-08

## Problem

Drilldown table columns were becoming too large when loaded. The saved percentage widths (e.g., 35%, 29%, 36%) were being applied to a larger reference width (the parent row width minus padding), causing columns to expand beyond their original sizes.

## Root Cause

1. When saving drilldown column widths, the code converted pixel widths to percentages based on the container width at save time
2. When loading, it converted percentages back to pixels using the parent row width as reference
3. The reference width at load time was often larger than the original container width, causing proportionally larger columns

## Solution

Changed drilldown column width storage to use pixel values directly instead of percentages:

1. **Saving** (`getColumnConfig`): Store the raw pixel width from `col.getWidth()` instead of calculating a percentage
2. **Loading** (`renderInlineDrilldown`): Use the stored pixel width directly without any conversion

## Changes Made

### `src/pages/DashboardViewer/DashboardCell.tsx`

**In `getColumnConfig` function:**
- Removed percentage calculation for drilldown columns
- Now stores `pixelWidth` directly instead of `percentWidth`

**In `renderInlineDrilldown` function:**
- Removed the percentage-to-pixel conversion logic
- Column widths are now passed directly to Tabulator as pixel values
- Removed the row width reference calculation that was used for percentage conversion

## Behavior After Fix

- Drilldown columns maintain their exact pixel sizes as set by the user
- Column widths persist accurately across page loads and row expansions
- Main grid columns continue to use percentage-based widths (unchanged)
