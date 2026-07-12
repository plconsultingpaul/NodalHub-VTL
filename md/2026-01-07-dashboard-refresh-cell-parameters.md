# Dashboard Refresh and Cell Parameter Changes

**Date:** 2026-01-07

## Summary

Two changes were made to the Dashboard Viewer:

1. **Refresh Button Behavior Fix**: The Refresh button no longer re-prompts users to enter parameters. It now refreshes data using the currently selected parameter values.

2. **Per-Cell Parameter Button**: Added a new button (sliders icon) to each cell header that has parameters. Users can click this to modify parameters for individual cells without affecting other cells.

## Changes Made

### File: `src/pages/DashboardViewer/index.tsx`

#### 1. Refresh Button Fix

- Added `initialParamsSetRef` to track whether the initial parameter modal has been shown for the current dashboard
- Modified the `useEffect` that shows the parameter modal to only trigger on first dashboard load
- The modal now only appears when `initialParamsSetRef.current !== activeDashboardId`
- After submitting parameters, the ref is updated to prevent re-prompting on refresh

#### 2. Per-Cell Parameter Button

- Added new state variables:
  - `editingCellId`: Tracks which cell's parameter modal is open
  - `cellParameterValues`: Stores cell-specific parameter overrides
- Added helper functions:
  - `getCellParameters()`: Gets parameters for a specific cell
  - `cellHasParameters()`: Checks if a cell has parameters
  - `handleCellParamChange()`: Updates cell-specific parameter values
  - `handleCellParamSubmit()`: Closes the cell parameter modal
  - `getEffectiveParamsForCell()`: Merges global parameters with cell-specific overrides
- Added `renderCellParamInput()` function for rendering parameter inputs in the cell modal
- Added a new Modal for editing cell-specific parameters
- Added SlidersHorizontal icon button to cell headers (only visible for cells with parameters)
- Updated `DashboardCell` components to use `getEffectiveParamsForCell()` instead of global `parameterValues`

## User Experience

- Clicking **Refresh** now reloads data using current parameter values without prompting
- Cells with parameters display a sliders icon in the header
- Clicking the sliders icon opens a modal to edit that cell's parameters
- Each cell can have its own parameter values independent of other cells
