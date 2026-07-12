# Per-Column Header Filter Visibility Toggles

## Date: 2026-01-08

## Summary
Extended the header filter visibility toggles to work at the per-column level in addition to the existing grid-level defaults. Users can now control the visibility of filter icons, calculations icons, and filter inputs independently for each column.

## Changes Made

### 1. Type Definition (`src/types/database.ts`)
Added three visibility properties to `GridColumnFormatting` interface:
- `showFilterIcon?: boolean`
- `showCalculationsIcon?: boolean`
- `showFilterInput?: boolean`

These properties allow per-column override of the grid-level visibility settings.

### 2. Grid Formatting Modal (`src/pages/DashboardViewer/GridFormattingModal.tsx`)
- Moved the "Header Filter Options" section outside the grid-only conditional block
- The section now appears for both "Grid (All Rows)" and individual column targets
- When a column is selected, a hint "(overrides grid default)" is displayed
- Checkbox state reads from grid-level settings when grid is selected, column-level settings when a column is selected
- Changes are saved to the appropriate location based on selected target

### 3. Dashboard Cell (`src/pages/DashboardViewer/DashboardCell.tsx`)
- Modified the column building loop to resolve visibility settings per-column
- For each column, checks if the column has explicit visibility settings defined
- Falls back to grid-level defaults if no column-specific settings exist
- Passes the resolved per-column settings via `titleFormatterParams`

## Inheritance Logic
1. Column-specific setting takes priority if explicitly defined
2. Falls back to grid-level setting if column setting is undefined
3. Defaults to `true` (visible) if neither is defined

## Usage
1. Open the Grid Formatting modal on a dashboard cell
2. To set defaults for all columns: select "Grid (All Rows)" and configure Header Filter Options
3. To override for a specific column: select that column and configure Header Filter Options
4. Column-specific settings will override the grid defaults for that column only
