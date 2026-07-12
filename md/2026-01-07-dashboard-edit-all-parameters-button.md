# Dashboard Edit All Parameters Button

**Date:** 2026-01-07

## Summary

Added a "Parameters" button next to the main Refresh button in the Dashboard Viewer header. This allows users to re-enter parameter values for all cells at once, similar to the initial dashboard load experience.

## Changes Made

Modified `src/pages/DashboardViewer/index.tsx`:

1. Added `handleEditAllParameters` function that opens the main parameter modal when clicked

2. Added a new "Parameters" button in the header toolbar (next to Refresh) that:
   - Only appears when the dashboard has cells with user parameters
   - Uses the SlidersHorizontal icon for consistency with the per-cell parameter buttons
   - Opens the same parameter modal that appears on initial dashboard load

## Behavior

- Button only visible when `requiredParameters.length > 0`
- Clicking opens the existing parameter modal with all parameters from all cells
- User enters values and clicks "Continue" to apply to all cells
- Works the same as the initial load parameter prompt
