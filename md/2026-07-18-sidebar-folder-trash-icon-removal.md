# 2026-07-18 Remove Trash Icon from Sidebar Folder Rows

## Summary

Removed the standalone trash icon that appeared on hover for sidebar folder rows, since the delete action is already accessible inside the Edit (pencil) modal.

## Changes

### `src/components/layout/Sidebar.tsx`
- Removed the `<Trash2>` button from the folder row hover actions in `renderFolderItems`
- The pencil (edit) button remains; users delete folders via the edit modal's Delete button
