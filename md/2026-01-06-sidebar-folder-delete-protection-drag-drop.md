# Sidebar Folder Delete Protection and Dashboard Drag & Drop

**Date:** 2026-01-06

## Summary

Added two features to the sidebar folder management:

1. **Folder Delete Protection** - Prevents users from deleting folders (projects) that contain dashboards or pulse items
2. **Dashboard Drag & Drop** - Allows users to drag dashboards from one folder to another

## Changes Made

### File Modified
- `src/components/layout/Sidebar.tsx`

### Feature 1: Folder Delete Protection

**Behavior:**
- When editing a folder that contains dashboards, the Delete button is disabled
- A warning message is displayed explaining why deletion is blocked
- Message includes the count of dashboards in the folder
- Users must move or delete all dashboards before the folder can be deleted

**Implementation:**
- Added `getProjectDashboardCount()` helper function to count dashboards in a project
- Added `canDeleteProject()` function that returns false if project has dashboards
- Modified `handleDeleteItem()` to check `canDeleteProject()` before proceeding
- Added conditional warning message in the Edit Modal
- Added `disabled` prop to Delete button based on `canDeleteProject()` result

### Feature 2: Dashboard Drag & Drop

**Behavior:**
- Dashboard items in the sidebar are now draggable
- Folder rows act as drop targets
- Visual feedback shows when dragging over a valid drop zone (ring highlight)
- Dashboard being dragged appears with reduced opacity
- On drop, dashboard is moved to the target folder
- Target folder auto-expands after successful drop

**Implementation:**
- Added state: `draggedDashboardId` and `dragOverProjectId`
- Added drag handlers: `handleDragStart`, `handleDragEnd`
- Added drop handlers: `handleDragOver`, `handleDragLeave`, `handleDrop`
- Dashboard rows have `draggable` attribute and drag event handlers
- Project folder rows have drop zone event handlers
- Visual styling for drag state (opacity) and drop target (ring highlight)
- Uses existing `updateDashboard()` to change `project_id` on drop

## Technical Notes

- Uses native HTML5 Drag and Drop API (no external library)
- Drop only allowed on folders of the same type (dashboards or pulse)
- Cursor changes to grab/grabbing when hovering/dragging dashboard items
