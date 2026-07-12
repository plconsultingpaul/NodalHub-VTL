# Dashboard Viewer - Hide Edit Button in View Mode

**Date:** 2026-01-06

## Summary

When clicking the Play icon on a dashboard in the sidebar, the Edit button in the DashboardViewer header is now hidden. This provides a cleaner view-only experience.

## Changes

### 1. ActiveDashboardsContext.tsx
- Added `viewOnly?: boolean` property to the `OpenDashboard` interface
- Updated `openDashboard` function signature to accept an optional `viewOnly` parameter
- When a dashboard is already open, the `viewOnly` flag is updated to the new value

### 2. Sidebar.tsx
- Updated `handleDashboardPlay` function to pass `true` as the second argument to `openDashboard`, indicating view-only mode

### 3. DashboardViewer/index.tsx
- Added conditional rendering around the Edit button: only shown when `activeDashboard.viewOnly` is not true

## Behavior

- **Play icon**: Opens dashboard in view-only mode (no Edit button)
- **Pencil icon**: Opens the Dashboard Builder (unchanged)
- If a dashboard is already open in view mode and the user clicks the pencil icon, it opens the builder as before
