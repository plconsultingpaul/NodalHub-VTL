# Grid Header Filter Visibility Toggles

## Date: 2026-01-08

## Summary
Added the ability to hide the three filter options in grid cell headers through the Grid Formatting modal's Basic Properties section.

## Changes Made

### 1. Type Definition (`src/types/database.ts`)
Added three new optional boolean properties to `GridCellFormattingRules`:
- `showFilterIcon` - controls visibility of the filter icon (funnel)
- `showCalculationsIcon` - controls visibility of the calculations icon (sigma)
- `showFilterInput` - controls visibility of the text filter input box

All properties default to `true` (visible) when not specified.

### 2. Grid Formatting Modal (`src/pages/DashboardViewer/GridFormattingModal.tsx`)
Added a new "Header Filter Options" section in the Basic Properties tab that appears when "Grid (All Rows)" is selected as the target. This section contains three checkboxes:
- Show Filter Icon
- Show Calculations Icon
- Show Filter Input

### 3. Dashboard Cell (`src/pages/DashboardViewer/DashboardCell.tsx`)
- Updated `createTitleWithFilter` function to read visibility settings from `formatterParams`
- Modified element rendering to conditionally append:
  - Filter icon and clear icon (based on `showFilterIcon`)
  - Sigma/calculations icon (based on `showCalculationsIcon`)
  - Filter input row with mode selector (based on `showFilterInput`)
- Added `titleFormatterParams` to column definitions to pass visibility settings

## Usage
1. Open a dashboard with a grid cell
2. Click the formatting button to open the Grid Formatting modal
3. Select "Grid (All Rows)" in the target panel
4. In the Basic Properties tab, find the "Header Filter Options" section
5. Toggle any of the three checkboxes to show/hide the corresponding header elements
6. Click Apply to save changes

## Notes
- Settings are stored in the grid template's formatting rules JSON
- No database migration required as settings use existing JSON storage
- Settings apply to all columns in the cell
