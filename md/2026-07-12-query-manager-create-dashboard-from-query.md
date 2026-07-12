# Query Manager: Create Dashboard from Query

**Date:** 2026-07-12

## Summary

Added the ability to create a new Dashboard directly from the Query Manager when creating a new query. After successfully saving a new query (with purpose type "Query"), a modal automatically appears offering to create a dashboard with that query. The feature is also available from the query list via an icon button.

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

**Modified `handleSave` function:**
- After a successful NEW query creation (not edit) with purpose_type 'query', automatically opens the "Create Dashboard" modal pre-filled with the query name and ID

**New functions:**
- `handleOpenCreateDashboard(query)` - opens modal from list row action
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

**Automatic trigger (after creating a new query):**
1. User creates a new query (any type: API, SQL, Stored Procedure) with purpose type "Query"
2. Query saves successfully and the query form modal closes
3. The "Create Dashboard from Query" modal automatically appears
4. User can create a dashboard or dismiss if not needed

**Manual trigger (from query list):**
1. User clicks the LayoutDashboard icon on any query row (only shown for purpose_type 'query')
2. Modal opens with dashboard name pre-filled as the query name

**Modal flow:**
1. User sets the dashboard name (pre-filled with query name)
2. User selects an existing folder from the CustomDropdown OR clicks "Create new folder" to define one inline with name + color picker
3. On submit:
   - If "new folder" mode is active, creates the folder first
   - Creates the dashboard in the selected/new folder
   - Inserts a single dashboard cell (100% width/height) with the query_id linked
4. Success state shows confirmation and option to open the new dashboard

## No Database Changes

All tables (`projects`, `dashboards`, `dashboard_cells`) already exist with the required schema. This is a purely UI/workflow enhancement.
