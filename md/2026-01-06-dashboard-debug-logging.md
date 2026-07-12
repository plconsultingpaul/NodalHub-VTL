# Dashboard Debug Logging

**Date:** 2026-01-06

## Summary

Added comprehensive console logging throughout the dashboard data loading pipeline to help diagnose intermittent blank dashboard issues.

## Problem

Dashboard occasionally appears blank when launched, with no visible errors. The issue is intermittent and difficult to reproduce.

## Solution

Added console logging at key points in the data flow:

1. **useDashboardConfig hook** - Logs database queries and responses
2. **DashboardViewer component** - Logs render state (activeDashboardId, cells count, loading state)
3. **DashboardCell component** - Logs API calls, responses, and Tabulator initialization

## Files Changed

### src/hooks/useDashboardConfig.ts
- Added logging for dashboardId changes
- Added logging for cells query results
- Added logging for drilldowns query results
- Added logging for final processed cells

### src/pages/DashboardViewer/index.tsx
- Added logging for render state (activeDashboardId, activeDashboard name, cells count, loading)

### src/pages/DashboardViewer/DashboardCell.tsx
- Added logging for cell rendering
- Added logging for executeQuery (endpoint lookup, URL construction, API response)
- Added logging for array extraction from API response
- Added logging for fetchData results
- Added logging for Tabulator initialization

## How to Use

1. Open browser DevTools (F12)
2. Go to Console tab
3. Filter by `[Dashboard` or `[useDashboard` to see relevant logs
4. Launch a dashboard and observe the log output

## Log Prefixes

- `[useDashboardConfig]` - Database queries for cells/drilldowns
- `[DashboardViewer]` - Component render state
- `[DashboardCell]` - Cell data fetching and table rendering

## Next Steps

After identifying the root cause, these logs should be removed or converted to conditional debug logging.
