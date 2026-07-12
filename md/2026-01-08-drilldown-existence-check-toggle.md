# Drilldown Existence Check Toggle Feature

**Date:** 2026-01-08

## Summary

Added a configurable toggle to enable/disable the drilldown existence check feature. This allows users to choose whether to pre-check if drilldown data exists for each row before showing expand icons. The feature is disabled by default to improve performance on large grids.

## Problem

The drilldown existence check feature (added previously) iterates through each row and executes a query to check if drilldown data exists. While useful for showing accurate expand icons, this can significantly slow down loading times on large grids with many rows.

## Solution

Added a "Pre-check drilldown data existence" checkbox in the Cell Configuration panel's Drill-Down Queries section. This allows users to:

- **Disable (default)**: All rows with drilldowns configured show expand icons immediately. Faster loading, but users won't know which rows have data until they click.
- **Enable**: Only rows with actual drilldown data show expand icons. Slower loading on large grids, but provides accurate visual feedback.

## Changes Made

### 1. Database Migration
- Added `check_drilldown_existence` boolean column to `dashboard_cells` table
- Default value: `false`

### 2. TypeScript Types (`src/types/database.ts`)
- Added `check_drilldown_existence: boolean` to DashboardCell Row type
- Added optional `check_drilldown_existence?: boolean` to Insert and Update types

### 3. Cell Config Panel (`src/pages/DashboardBuilder/CellConfigPanel.tsx`)
- Added `check_drilldown_existence` to CellConfig interface
- Added checkbox with description in the Drill-Down Queries section
- Checkbox only appears when at least one drilldown is configured

### 4. Dashboard Builder (`src/pages/DashboardBuilder/index.tsx`)
- Added `check_drilldown_existence` to CellConfig interface
- Added default value `false` in all cell initialization locations
- Added mapping from existing cells to include the new field

### 5. Dashboard Config Hook (`src/hooks/useDashboardConfig.ts`)
- Added `check_drilldown_existence` to saveCellsLayout parameter type
- Added field to cellData object for database save

### 6. Dashboard Cell (`src/pages/DashboardViewer/DashboardCell.tsx`)
- Modified fetchData to check `cell.check_drilldown_existence` before calling `checkDrilldownExistence()`
- When disabled: Sets all row indices as having drilldown availability (all show expand icons)
- When enabled: Runs the existence check as before

## Usage

1. Open Dashboard Builder
2. Select a cell and click Configure
3. Add one or more drilldown queries
4. Optionally check "Pre-check drilldown data existence" if you want the system to verify data exists before showing expand icons
5. Save the configuration

## Performance Considerations

- **Small grids (< 100 rows)**: Enabling the check is reasonable
- **Large grids (100+ rows)**: Keep disabled for faster loading
- Each row requires a separate API call when check is enabled
