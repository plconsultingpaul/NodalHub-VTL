# Sidebar Auto-Expand on Section Click

**Date:** 2026-01-08

## Summary

When the sidebar is collapsed and the user clicks on the Dashboards or Pulse section buttons, the sidebar now automatically expands to reveal the section content.

## Changes Made

**File:** `src/components/layout/Sidebar.tsx`

1. Added `setCollapsed` to the destructured values from `useSidebar()` hook
2. Updated `toggleSection` function to call `setCollapsed(false)` when the sidebar is collapsed

## Behavior

- Clicking Home, Dashboards, or Pulse section icons when sidebar is collapsed will expand the sidebar
- The selected section will expand as normal after the sidebar opens
