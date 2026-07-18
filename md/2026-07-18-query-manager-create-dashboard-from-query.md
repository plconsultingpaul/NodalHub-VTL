# 2026-07-18 Query Manager - Create Dashboard "Open Dashboard" Navigation Fix

## Summary

Fixed the "Open Dashboard" button in the Query Manager's "Create Dashboard from Query" modal so it correctly opens the newly created dashboard in the Dashboard Viewer, instead of navigating to an unrelated legacy route.

## Problem

After creating a dashboard from a query, clicking "Open Dashboard" used `window.location.href = '/dashboard/${id}'` which navigated to the `/dashboard/:dashboardId` route -- a legacy widget-based page. The sidebar, by contrast, opens dashboards by registering them in the `ActiveDashboardsContext` and navigating to `/` (where the Home page renders the DashboardViewer).

## Changes

### `src/pages/QueryManager/index.tsx`
- Added `useNavigate` import from `react-router-dom`
- Added `useActiveDashboards` import from `../../contexts/ActiveDashboardsContext`
- Added `dashboardCreatedData` state to store the full dashboard object returned after creation
- Replaced `window.location.href` with `openDashboard(dashboardCreatedData, true)` + `navigate('/')` to use the same mechanism as the sidebar
- Cleared `dashboardCreatedData` in `handleCloseCreateDashboard` cleanup
