# 2026-07-18 Dashboard and Pulse Sort Order in Folders

## Summary

Added the ability to reorder dashboards and pulses within a folder via drag-and-drop in the Edit Project modal.

## Changes

### Database Migration
- Added `sort_order integer NOT NULL DEFAULT 0` column to `dashboards` table
- Added `sort_order integer NOT NULL DEFAULT 0` column to `pulses` table

### `src/types/database.ts`
- Added `sort_order: number` to Dashboard Row type
- Added `sort_order?: number` to Dashboard Insert and Update types
- Added `sort_order: number` to Pulse Row type
- Added `sort_order?: number` to Pulse Insert and Update types

### `src/contexts/ProjectsContext.tsx`
- Changed dashboard fetch to order by `sort_order` then `created_at`
- Changed pulse fetch to order by `sort_order` then `created_at`
- Added `reorderDashboards(orderedIds: string[])` function
- Added `reorderPulses(orderedIds: string[])` function

### `src/components/layout/Sidebar.tsx`
- Added `sortOrderItems` state and `dragSortRef` / `dragSortOverRef` refs for drag tracking
- `openEditModal` now populates `sortOrderItems` with the project's dashboards and pulses
- Added "Item Order" drag-and-drop section to the Edit Project modal (uses native HTML5 drag-and-drop with GripVertical icon handles, same pattern as GridFormattingModal)
- `handleEditItem` now calls `reorderDashboards` and `reorderPulses` on save

## Behavior

- When editing a folder, an "Item Order" section appears showing all dashboards and pulses in that folder
- Users can drag items by the grip handle to reorder them
- On save, the new order is persisted to the database
- The sidebar reflects the saved order immediately
