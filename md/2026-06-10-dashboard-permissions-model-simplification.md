# Dashboard Permissions Model Simplification

**Date:** 2026-06-10

## Summary

Changed the dashboard permission model from per-dashboard "View/Edit" toggles to a simpler two-concern model:
1. A single global "Add & Edit Dashboards" toggle
2. Per-dashboard visibility checkboxes

## Previous Model

Each dashboard had an individual View or Edit button. A user with "Edit" on Dashboard A but "View" on Dashboard B would get different capabilities per dashboard.

## New Model

- **`dashboard_edit` permission** (global toggle, `resource_id: null`): Grants ability to create new dashboards and edit any dashboard the user can see.
- **`dashboard` permission** (per-dashboard, `resource_id: <id>`, `access_level: 'view'`): Controls which dashboards are visible to the user.

If a user has `dashboard_edit` + visibility on a dashboard, they get full edit access. If they only have visibility (no `dashboard_edit`), they can view but not edit.

## Files Changed

- **`src/components/PermissionsPanel.tsx`** - Replaced View/Edit buttons with a global "Add & Edit Dashboards" toggle card at the top, followed by a visibility checklist with simple checkboxes per dashboard.
- **`src/contexts/AuthContext.tsx`** - Updated `getDashboardAccess()` to check global `dashboard_edit` permission for edit capability, and per-dashboard `dashboard` permission for visibility. Updated `UserPermission` interface and `hasPermission` type to include `'dashboard_edit'`.

## How It Works

- `getDashboardAccess(id)` returns:
  - `'edit'` if admin OR (has `dashboard_edit` permission AND dashboard is visible)
  - `'view'` if dashboard is visible but no `dashboard_edit` permission
  - `'none'` if dashboard is not in the user's visible list
- Sidebar and DashboardBuilder already use `getDashboardAccess()` so they inherit the new behavior without code changes.
