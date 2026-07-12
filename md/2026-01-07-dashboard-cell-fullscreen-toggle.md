# Dashboard Cell Fullscreen Toggle

**Date:** 2026-01-07

## Summary

Added a fullscreen toggle feature for dashboard cells when a dashboard contains more than one cell.

## Changes Made

### File: `src/pages/DashboardViewer/index.tsx`

1. **Added imports**: `Maximize2` and `Minimize2` icons from lucide-react

2. **Added state**: `fullscreenCellId` to track which cell (if any) is in fullscreen mode

3. **Added fullscreen icon to cell headers**:
   - Only displayed when `cells.length > 1`
   - Shows `Maximize2` icon in normal view
   - Shows `Minimize2` icon when that cell is in fullscreen mode

4. **Updated rendering logic**:
   - When `fullscreenCellId` is set, renders only that cell at full height
   - When no cell is fullscreen, renders the normal grid layout
   - Clicking the icon toggles between fullscreen and normal view

## Behavior

- The fullscreen icon appears in the far right of each cell's header
- Icon only appears when there are 2 or more cells in the dashboard
- Clicking the icon expands that cell to fill the entire dashboard area
- Clicking the minimize icon returns to the normal multi-cell layout
- All cell functionality (data, filtering, selection) is preserved in fullscreen mode
