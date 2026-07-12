# Parameter Modal - Apply Only on Submit

**Date:** 2026-01-07

## Problem

When clicking the Filter (SlidersHorizontal) button on a dashboard cell, the Parameters modal opens. When changing a parameter value (e.g., selecting a different option from a dropdown), the grid immediately updates before the user clicks "Apply".

The expected behavior is that the grid should only update when the user clicks "Apply", not on every input change.

## Root Cause

The `handleCellParamChange` function was directly updating the `cellParameterValues` state on every input change. Since the DashboardCell component receives parameters via `getEffectiveParamsForCell()` which reads from `cellParameterValues`, any change immediately triggered a re-fetch.

## Fix

Modified `src/pages/DashboardViewer/index.tsx`:

1. Added a new state `pendingCellParamValues` to hold temporary values while editing in the modal

2. Created `openCellParamModal(cellId)` function that:
   - Copies current parameter values into `pendingCellParamValues`
   - Opens the modal by setting `editingCellId`

3. Modified `handleCellParamChange` to update `pendingCellParamValues` instead of `cellParameterValues`

4. Modified `handleCellParamSubmit` to copy `pendingCellParamValues` to `cellParameterValues` only when "Apply" is clicked

5. Updated `editingCellValues` to read from `pendingCellParamValues` for modal display

6. Updated button click handlers to use `openCellParamModal()` instead of directly setting `editingCellId`

## Result

- Changes in the parameter modal are now stored in a temporary state
- The grid only updates when the user clicks "Apply"
- Clicking "Cancel" discards changes and closes the modal without updating the grid
