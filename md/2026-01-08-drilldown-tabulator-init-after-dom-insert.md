# Drilldown Tabulator Width Reference Fix

**Date:** 2026-01-08

## Problem

The drilldown Tabulator tables were rendering with 0px column widths because the container width polling always returned 0, even after the drilldown row was inserted into the DOM.

### Root Cause

The `tableContainer` div has `width:100%` but its parent chain (`section` -> `wrapper` -> `td`) lacks explicit width values. When querying `tableContainer.offsetWidth`, the browser returns 0 because percentage-width elements inside non-laid-out parents don't have computed dimensions.

Even after inserting the drilldown row into the DOM, the nested container still doesn't get a computed width because:
- The `<td>` element doesn't have an explicit width
- The wrapper div only has padding, no width
- The container div with `width:100%` has nothing to calculate against

## Solution

Instead of polling the container's width (which was always 0), use the parent row element's width as the reference for percentage-to-pixel conversion:

1. Capture `rowElement.offsetWidth` immediately after DOM insertion - the parent row is already visible and has computed dimensions
2. Account for wrapper padding (24px left + 8px right = 32px total)
3. Use this adjusted width as the reference for converting percentage column widths to pixels
4. Initialize Tabulators immediately without polling

This approach is more reliable because:
- The parent row (`rowElement`) is already in the DOM and rendered
- We don't need to wait for the new container to get layout
- The width calculation is deterministic rather than polling-based

## Files Changed

- `src/pages/DashboardViewer/DashboardCell.tsx`
  - Added `pendingTabulatorInits` array to collect initialization data during drilldown loop
  - Replaced container width polling with direct calculation from `rowElement.offsetWidth`
  - Removed `requestAnimationFrame` polling loop - Tabulators initialize synchronously after DOM insertion
  - Added debug logging showing reference width used for conversion
