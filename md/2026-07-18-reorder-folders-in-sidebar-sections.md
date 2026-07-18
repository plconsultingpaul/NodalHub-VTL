# 2026-07-18 Reorder Folders in Sidebar Sections

## Summary

Added the ability to reorder folders within the DASHBOARDS and PULSE sidebar sections via a drag-and-drop modal, accessible from a new pencil (edit) icon in each section header.

## Changes

### `src/contexts/ProjectsContext.tsx`
- Added `reorderProjects(orderedIds: string[])` function that batch-updates `sort_order` on the `projects` table
- Exposed `reorderProjects` on the context interface

### `src/components/layout/Sidebar.tsx`
- Added `showReorderFoldersModal`, `reorderFolderType`, `folderOrder` state and `dragFolderRef` / `dragFolderOverRef` refs
- Added `openReorderFoldersModal(type)` and `handleSaveReorderFolders()` handlers
- Added a Pencil icon button next to the expand/collapse and "New Folder" buttons in both the DASHBOARDS and PULSE section headers
- Added a "Reorder Folders" modal with native HTML5 drag-and-drop (GripVertical handles, color dots, folder names)
- Save button persists the new folder order to the database

## Behavior

- Clicking the pencil icon in a section header opens a modal listing all folders in that section
- Users can drag folders by the grip handle to reorder them
- On save, the new order is persisted via the existing `sort_order` column on the `projects` table
- The sidebar immediately reflects the new order
