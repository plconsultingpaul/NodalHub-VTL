# Drilldown Table Formatting in Grid Formatting Modal

**Date:** 2026-01-09

## Summary

Added the ability to format drilldown tables within the Grid Formatting modal. Drilldown columns now appear in the left sidebar alongside main table columns, and formatting can be applied at the row level (all rows) or to specific columns.

## Changes Made

### 1. Type Definitions (`src/types/database.ts`)

- Added new `DrilldownFormattingRules` interface to define formatting structure for drilldowns:
  - `grid` - Row-level formatting applied to all cells in the drilldown
  - `columns` - Per-column formatting overrides
  - `conditionalFormatting` - Reserved for future conditional formatting support

- Extended `GridCellFormattingRules` to include:
  - `drilldowns` - A record mapping drilldown IDs to their respective `DrilldownFormattingRules`

### 2. GridFormattingModal (`src/pages/DashboardViewer/GridFormattingModal.tsx`)

- Exported new `DrilldownDefinition` interface for passing drilldown info to the modal
- Added `drilldowns` prop to accept drilldown definitions (id, displayName, columns)
- Refactored `selectedTarget` state from string to discriminated union type:
  - `{ type: 'grid' }` - Main table row-level formatting
  - `{ type: 'column', field: string }` - Main table column formatting
  - `{ type: 'drilldown-grid', drilldownId: string }` - Drilldown row-level formatting
  - `{ type: 'drilldown-column', drilldownId: string, field: string }` - Drilldown column formatting
- Added `expandedDrilldowns` state to track which drilldown sections are expanded
- Updated sidebar UI to display:
  - "Main Table" section header
  - Grid (All Rows) option for main table
  - Expandable Columns section for main table
  - Separate section for each drilldown with its own Grid and Columns options
- Updated `currentFormatting`, `updateFormatting`, and `handleReset` functions to handle all target types
- Header Filter Options only shown for main table (grid and column targets)

### 3. DashboardViewer (`src/pages/DashboardViewer/index.tsx`)

- Added `drilldownColumns` state to track detected columns per drilldown per cell
- Added `handleDrilldownColumnsDetected` callback for when drilldown columns are detected
- Added `getDrilldownDefinitions` function to build drilldown definitions for the modal
- Updated `GridFormattingModal` to receive `drilldowns` prop
- Updated both `DashboardCell` instances to pass `onDrilldownColumnsDetected` callback

### 4. DashboardCell (`src/pages/DashboardViewer/DashboardCell.tsx`)

- Added `onDrilldownColumnsDetected` prop to interface
- Added ref for the callback (`onDrilldownColumnsDetectedRef`)
- Updated `renderInlineDrilldown` function to:
  - Call `onDrilldownColumnsDetectedRef` when drilldown columns are detected
  - Read drilldown formatting from `formattingRulesRef`
  - Apply grid-level and column-level formatting to drilldown cells via custom formatter
  - Support `displayName` override for drilldown column headers
  - Apply background color, text color, font family, font size, bold, italic, and underline styles

## UI Structure

The left sidebar in Grid Formatting modal now shows:

```
MAIN TABLE
  [icon] Grid (All Rows)           <- Applies to all main table rows
  [>] Columns
      - column_name_1              <- Applies to specific column cells
      - column_name_2

DRILLDOWN: Order Details
  [icon] Grid (All Rows)           <- Applies to all drilldown rows
  [>] Columns
      - line_item                  <- Applies to specific drilldown column
      - quantity

DRILLDOWN: Payment History
  [icon] Grid (All Rows)
  [>] Columns
      - payment_date
      - amount
```

## Files Modified

1. `src/types/database.ts` - Added DrilldownFormattingRules type
2. `src/pages/DashboardViewer/GridFormattingModal.tsx` - Added drilldown sections to sidebar
3. `src/pages/DashboardViewer/index.tsx` - Passing drilldown info to modal
4. `src/pages/DashboardViewer/DashboardCell.tsx` - Detecting columns and applying formatting
