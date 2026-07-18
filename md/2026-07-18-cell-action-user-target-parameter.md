# 2026-07-18 Cell Action User Target Parameter Mapping

## Summary

Added a new "User" target option to cell action parameter mappings. This allows an action parameter to be automatically populated with the logged-in user's **Username** or **Name** (full_name) without requiring any user input at execution time.

## Problem

Previously, if an action needed to pass the current user's identity (e.g., username for audit logging or name for display), the only option was to hard-code it or prompt the user to type it manually. There was no way to automatically inject the logged-in user's profile data.

## Changes

### `src/types/database.ts`
- Added `'user'` to the `ActionParameterMapping.target` union type
- Added optional `userField?: 'username' | 'full_name'` property

### `src/pages/DashboardViewer/ActionsConfigModal.tsx`
- Added "User" option to the target dropdown in all 3 parameter mapping sections (execute, popup, link actions)
- Added `handleMappingUserFieldChange` handler
- When "User" is selected, a secondary CustomDropdown appears to choose between "Username" and "Name"
- Updated type cast on `onChange` handlers to include `'user'`
- `handleMappingTargetChange` now sets `userField` default to `'username'` when target is `'user'`

### `src/pages/DashboardViewer/actionExecutor.ts`
- Imported `Profile` type
- `buildParamValues` now accepts optional `userProfile` parameter and resolves `'user'` target mappings from it
- `executeActionForRow` accepts and passes `userProfile` to `buildParamValues` and path variable resolution
- `executeActionForRows` accepts and passes `userProfile` through
- `executeLinkAction` accepts and passes `userProfile` through
- Path variable resolution handles `'user'` target

### `src/pages/DashboardViewer/DashboardCell.tsx`
- Imported `useAuth` from AuthContext
- Added `const { profile } = useAuth()` hook call
- Passes `profile` to all `executeActionForRows` and `executeLinkAction` calls

## How It Works

1. In the Actions Config modal, select "User" as the target for a parameter
2. Choose either "Username" or "Name" from the sub-dropdown
3. At execution time, the parameter is automatically filled with the logged-in user's username or full_name from their profile -- no prompt dialog needed
