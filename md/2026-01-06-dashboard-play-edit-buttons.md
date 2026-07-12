# Dashboard Play and Edit Buttons

**Date:** 2026-01-06

## Summary

Added explicit Play and Edit action buttons to dashboard items in the sidebar, replacing the previous auto-launch behavior.

## Changes Made

### File: `src/components/layout/Sidebar.tsx`

1. **Removed auto-launch on click**: Dashboard names no longer launch the dashboard when clicked. The name is now a static label (still draggable for reordering).

2. **Added Play button**: A play icon button appears on hover to the left of the "..." menu. Clicking this opens the dashboard in view-only mode (Dashboard Viewer) without configuration options.

3. **Added Edit button**: A pencil icon button appears on hover between the Play button and the "..." menu. Clicking this opens the dashboard in edit mode (Dashboard Builder) with full configuration options including Configure, Add Row, Split Cell, and Save Dashboard.

4. **New handler functions**:
   - `handleDashboardPlay(dashboard)` - Opens dashboard in view mode
   - `handleDashboardEdit(dashboard)` - Opens dashboard in builder/edit mode

## Visual Layout

```
[Dashboard Name]  [Play] [Edit] [...]
```

All action buttons appear on hover and have hover states with subtle background highlights.

## Behavior

- **Play button**: Calls `openDashboard()` to launch Dashboard Viewer (read-only)
- **Edit button**: Calls `openBuilder()` to launch Dashboard Builder (edit mode with toolbar)
- **Dashboard name**: No click action, serves as a label only (maintains drag functionality)
