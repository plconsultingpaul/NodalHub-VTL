# User Permissions System

**Date:** 2026-06-10

## Summary

Replaced the three-role model (Admin/Editor/Viewer) with a simplified two-tier system: Admin (full access) vs User (granular permissions). Non-admin users now receive fine-grained access control for dashboards, Pulse, and settings tabs.

## Changes

### Database

- **New table: `user_permissions`** - Stores per-user, per-company permission grants with columns: `user_id`, `company_id`, `permission_type` (dashboard/pulse/settings_tab), `resource_id`, `access_level` (view/edit/access).
- RLS policies ensure users can read their own permissions and admins can manage all permissions within their company.

### Role Simplification

- `CompanyWithRole` type changed from `'Admin' | 'Editor' | 'Viewer'` to `'Admin' | 'User'`.
- All references to `Editor`/`Viewer` roles removed across the codebase.
- `invite-user` edge function updated to accept `'Admin' | 'User'` role and a `permissions` array.

### AuthContext

- Added `permissions`, `isAdmin`, `hasPermission(type, resourceId?)`, `getDashboardAccess(dashboardId)`, and `refreshPermissions()` to the auth context.
- Permissions are fetched whenever the active company changes.

### Team Members Page (3-Step Wizard)

- Step 1: User details (username, email, name) + Admin toggle.
- Step 2: Permissions panel (skipped for admins) - select dashboards (view/edit), Pulse access, settings tabs.
- Step 3: Review summary + send invite.
- Existing users can have their permissions edited via a Shield icon button.

### New Component: `PermissionsPanel`

- Reusable component with left sidebar (Dashboards/Pulse/Settings categories).
- Dashboard list with per-dashboard View/Edit toggle.
- Pulse toggle card.
- Settings tabs with checkboxes.
- Select All / Clear All actions.

### Permission Enforcement

- **Sidebar:** Pulse section hidden if user lacks pulse permission. Dashboard list filtered to only show dashboards the user has access to. Edit/delete buttons hidden for view-only dashboards.
- **SettingsLayout:** Tabs filtered based on `settings_tab` permissions for non-admin users.
- **DashboardBuilder:** Closes automatically if user lacks edit access to the target dashboard.

### Edge Function (`invite-user`)

- Accepts `permissions` array in request body.
- Saves permission rows to `user_permissions` table after creating user/membership.
- Clears existing permissions before inserting (for re-invites).

## Files Modified

- `supabase/migrations/20260610_create_user_permissions_table.sql`
- `src/contexts/AuthContext.tsx`
- `src/components/PermissionsPanel.tsx` (new)
- `src/pages/Settings/TeamMembers.tsx`
- `src/pages/Settings/SettingsLayout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/pages/DashboardBuilder/index.tsx`
- `src/types/database.ts`
- `src/pages/Settings/ApiSpecs.tsx`
- `src/pages/Settings/ApiEndpoints.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Home.tsx`
- `src/components/layout/CompanySwitcher.tsx`
- `supabase/functions/invite-user/index.ts`
