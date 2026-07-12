# Dashboard Builder - Cell Full Height Fix

**Date:** 2026-01-06

## Problem

When creating a new dashboard, the default cell was not filling the full screen height despite showing "100% x 100%" dimensions.

## Root Cause

The `<main>` element in MainLayout had no height defined. DashboardBuilder uses `h-full` (height: 100%), but 100% of undefined height = content height only.

## Fix

Updated `src/components/layout/MainLayout.tsx` to establish proper height chain:

```jsx
// Before
<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
  <Sidebar />
  <main className={`content-transition ${collapsed ? 'ml-[72px]' : 'ml-64'}`}>
    <Outlet />
  </main>
</div>

// After
<div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
  <Sidebar />
  <main className={`h-full overflow-auto content-transition ${collapsed ? 'ml-[72px]' : 'ml-64'}`}>
    <Outlet />
  </main>
</div>
```

Also updated DashboardBuilder to use flex-based row sizing for better proportional distribution.
