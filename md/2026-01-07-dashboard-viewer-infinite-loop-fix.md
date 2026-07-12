# Dashboard Viewer Infinite Loop Fix

**Date:** 2026-01-07

## Problem

The Dashboard Viewer cells were stuck in an infinite "Loading data..." state due to an infinite render loop.

## Root Cause

Two issues were causing infinite loops:

### 1. DashboardViewer - Parameter initialization effect

The useEffect that handles parameter detection was running state setters on every execution, even after the dashboard was already initialized.

### 2. DashboardCell - Object reference instability

The `parameterValues` prop was being passed as a new object on every render (due to object spreading in `getEffectiveParamsForCell`). This caused:

1. `executeQuery` callback to recreate (it depended on `parameterValues`)
2. `fetchData` callback to recreate (it depended on `executeQuery`)
3. The useEffect to run `fetchData()` again
4. API call triggers state update
5. Re-render with new `parameterValues` object reference
6. Infinite loop

## Fix

### DashboardViewer (`src/pages/DashboardViewer/index.tsx`)

Added early return at the start of the parameter initialization effect when the dashboard is already initialized:

```javascript
if (initialParamsSetRef.current === activeDashboardId) return;
```

Also moved the ref assignment to happen immediately, before any state setters run.

### DashboardCell (`src/pages/DashboardViewer/DashboardCell.tsx`)

1. Added a ref to store parameter values and a stable string key for comparison:
   ```javascript
   const parameterValuesRef = useRef(parameterValues);
   const parameterValuesKey = JSON.stringify(parameterValues);
   useEffect(() => {
     parameterValuesRef.current = parameterValues;
   }, [parameterValuesKey]);
   ```

2. Modified `executeQuery` to read from the ref instead of the prop, and removed `parameterValues` from its dependency array. This makes `executeQuery` stable across renders.

3. Added a separate effect that re-fetches data only when parameter values actually change (using the JSON string key), not on every render.

## Result

- Dashboard cells now load data once and don't get stuck in loading loops
- Parameter changes still trigger data re-fetch as expected
- The fix uses refs and stable string keys to break the object reference loop
