# Sidebar Folder and Plus Button Changes

**Date:** 2025-01-05

## Summary

Updated the sidebar navigation to separate folder creation from item creation within folders.

## Changes Made

### Section-Level + Button (Dashboards/Pulse Headers)
- Changed from dropdown menu to direct action
- Now only creates folders (no longer shows "New Dashboard" option)
- Clicking + on Dashboards section creates a Dashboard folder
- Clicking + on Pulse section creates a Pulse folder

### Folder-Level + Button
- Added a + button to each folder row (appears on hover)
- Button is a placeholder for future "Add Dashboard" or "Add Pulse" functionality
- Logs action to console for now

### UI Text Updates
- Modal title changed from "Project" to "Folder"
- Form label changed from "Project Name" to "Folder Name"
- Placeholder text changed from "My Project" to "My Folder"
- Button text changed from "Create Project" to "Create Folder"
- Empty state changed from "No projects yet" to "No folders yet"

## Files Modified

- `src/components/layout/Sidebar.tsx`
