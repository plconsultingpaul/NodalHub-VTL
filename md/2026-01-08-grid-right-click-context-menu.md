# Grid Right-Click Context Menu

**Date:** 2026-01-08

## Summary

Added a right-click context menu to the grid that allows users to copy cell values, entire rows, or all values in a column.

## Changes

### File Modified: `src/pages/DashboardViewer/DashboardCell.tsx`

1. **Added `cellContextMenu` configuration** - Defines the context menu items with three options:
   - **Copy Cell Value** - Copies the clicked cell's value to clipboard
   - **Copy Row** - Copies all values from the row (tab-separated) to clipboard
   - **Copy Column** - Copies all values in that column (newline-separated) to clipboard

2. **Added `contextMenu` property to each column definition** - This ensures the context menu receives the actual cell component (not just the row), allowing `getValue()` to return the correct cell value.

### File Modified: `src/index.css`

3. **Added context menu styling** - Styled the Tabulator menu to match the application's design:
   - White background with rounded corners and shadow
   - Hover states for menu items
   - Separator styling
   - Dark mode support

## Usage

Right-click on any cell in the grid to see the context menu with copy options.
