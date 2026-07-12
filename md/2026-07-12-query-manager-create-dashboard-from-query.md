# Query Manager: Create Dashboard from Query

**Date:** 2026-07-12

## Summary

Added the ability to create a new Dashboard directly from the Query Manager when working with a query. This streamlines the workflow of creating a query and immediately putting it into a dashboard.

## Changes

### File: `src/pages/QueryManager/index.tsx`

**New imports:**
- `LayoutDashboard`, `FolderPlus` icons from lucide-react
- `useProjects` context for folder/dashboard creation

**New state variables:**
- `showCreateDashboard` - modal visibility
- `createDashboardQueryId` - query to link to the new dashboard
- `createDashboardName` - name input (pre-filled with query name)
- `createDashboardFolderId` - selected folder
- `showNewFolderInline` - toggle for inline folder creation
- `newFolderName` / `newFolderColor` - new folder fields
- `dashboardCreatedId` - success state with link to new dashboard

**New functions:**
- `handleOpenCreateDashboard(query)` - opens modal with defaults
- `handleCloseCreateDashboard()` - resets state and closes
- `handleCreateDashboardSubmit()` - creates folder (if new), dashboard, and single cell linked to query

**UI additions:**
- LayoutDashboard icon button in the actions column (visible only for queries with purpose_type = 'query')
- "Create Dashboard from Query" modal with:
  - Dashboard name input (pre-filled with query name)
  - Folder selector using CustomDropdown
  - "Create new folder" inline option with name + color picker
  - Success state showing confirmation and "Open Dashboard" button

## Behavior

1. User clicks the LayoutDashboard icon on any query row (only shown for purpose_type 'query')
2. Modal opens with dashboard name pre-filled as the query name
3. User selects an existing folder from the dropdown OR clicks "Create new folder" to define a new one inline
4. On submit:
   - If "new folder" mode is active, creates the folder first
   - Creates the dashboard in the selected/new folder
   - Inserts a single dashboard cell (100% width/height) with the query_id linked
5. Success state shows confirmation and option to open the new dashboard

## No Database Changes

All tables (`projects`, `dashboards`, `dashboard_cells`) already exist with the required schema. This is a purely UI/workflow enhancement.
