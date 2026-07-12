# Dashboard Builder Duplicate Save Fix

**Date**: 2026-01-06
**Issue**: Clicking "Save Dashboard" multiple times created duplicate dashboards

## Problem

When clicking "Save Dashboard" rapidly multiple times:
1. Multiple dashboards with the same name were created
2. Each click triggered a new INSERT instead of updating the existing dashboard

## Root Cause

Two issues combined:

1. **State timing**: The `saving` state used to disable the button is asynchronous. Rapid clicks could trigger multiple `handleSave` calls before React re-rendered with the disabled state.

2. **Missing ID tracking**: After creating a new dashboard, the `builderDashboardId` from context remained `null`. Subsequent saves checked `!dashboardId` (which was `builderDashboardId`), saw `null`, and created new dashboards.

## Fix Applied

### 1. Added synchronous save guard using `useRef`

```tsx
const saveInProgressRef = useRef(false);
```

At the start of `handleSave`:
```tsx
if (saveInProgressRef.current) return;
saveInProgressRef.current = true;
```

In finally block:
```tsx
saveInProgressRef.current = false;
```

Refs update synchronously, so even rapid clicks are blocked before the async operation begins.

### 2. Check local dashboard state for ID

Changed:
```tsx
let dashboardId = builderDashboardId;
```

To:
```tsx
let dashboardId = builderDashboardId || dashboard?.id;
```

This uses the locally-stored dashboard ID (set via `setDashboard(newDashboard)` after first save) as a fallback, ensuring subsequent saves UPDATE instead of INSERT.

## Files Changed

- `src/pages/DashboardBuilder/index.tsx`

## Result

- Save button now properly blocks multiple clicks
- Dashboard is saved and builder closes after save
- No duplicate dashboards created
