# Dashboard Parameter Reset on Dashboard Switch

**Date:** 2026-01-10

## Issue

When opening a second dashboard while one is already open, the parameter modal showed the first dashboard's parameter values instead of the second dashboard's parameters.

**Steps to reproduce:**
1. Open Dashboard #1 - Enter parameters - Dashboard opens properly
2. Open Dashboard #2 - Parameter modal shows Dashboard #1's values instead of Dashboard #2's
3. Filling out the form with Dashboard #2's parameters results in no data

## Root Cause

In `DashboardViewer/index.tsx`, when `activeDashboardId` changed (user switched dashboards), the parameter-related state was not being reset. The effect that ran on dashboard change only reset template state:

```javascript
useEffect(() => {
  setSelectedTemplateId(null);
  setHasColumnChanges(false);
}, [activeDashboardId]);
```

This left `parameterValues`, `pendingGlobalParamValues`, `cellParameterValues`, `requiredParameters`, and `initialParamsSetRef` with stale values from the previous dashboard.

## Solution

Added parameter state reset to the existing `activeDashboardId` change effect:

```javascript
useEffect(() => {
  setSelectedTemplateId(null);
  setHasColumnChanges(false);
  setParameterValues({});
  setPendingGlobalParamValues({});
  setCellParameterValues({});
  setRequiredParameters([]);
  setParametersReady(false);
  initialParamsSetRef.current = null;
}, [activeDashboardId]);
```

This ensures all parameter state is cleared when switching dashboards, allowing the parameter extraction logic to run fresh for the new dashboard.

## Files Changed

- `src/pages/DashboardViewer/index.tsx` - Added parameter state reset in the `activeDashboardId` change effect
