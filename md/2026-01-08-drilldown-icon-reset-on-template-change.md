# Drilldown Icon Reset on Template Change

**Date:** 2026-01-08

## Issue

When changing the grid template while a drilldown row was expanded, the drilldown would visually close (the inline drilldown row would be removed from the DOM), but the expand icon would still show the "expanded" state (down chevron instead of right chevron).

## Root Cause

When the template changes, the Tabulator is destroyed and rebuilt, which removes the inline drilldown DOM elements. However, the `expandedRows` state was not being cleared. The expand icon formatter checks `expandedRowsRef.current.has(rowIndex)` and was incorrectly showing the expanded chevron for rows that were previously expanded.

## Fix

Added `setExpandedRows(new Set());` in the main Tabulator useEffect (which has `templateId` as a dependency) to clear the expanded rows state when the table is rebuilt.

## File Changed

- `src/pages/DashboardViewer/DashboardCell.tsx`
