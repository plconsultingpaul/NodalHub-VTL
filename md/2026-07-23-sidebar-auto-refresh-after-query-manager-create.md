# Sidebar Auto-Refresh After Creating Dashboard/Pulse from Query Manager

**Date:** 2026-07-23

## Problem

When a user creates a SQL Query in the Query Manager and then opts to create a Dashboard or Pulse from the post-save prompt, the newly created item does not appear in the sidebar until the page is manually refreshed.

## Root Cause

The sidebar displays dashboards and pulses using data from `ProjectsContext` (which fetches from the `projects`, `dashboards`, and `pulses` tables together). 

- **Dashboard creation** already worked correctly because `createDashboard()` is called directly from `ProjectsContext`, which internally calls `await fetchProjects()` after the insert — updating the shared state the sidebar consumes.

- **Pulse creation** was broken because the Query Manager uses the standalone `usePulses()` hook to create the pulse. That hook updates its own local state but does NOT notify `ProjectsContext` to refetch. The sidebar never learns about the new pulse until the next full page load.

## Fix

In `src/pages/QueryManager/index.tsx`:

1. Destructured `refetch: refetchProjects` from `useProjects()`.
2. Added `await refetchProjects()` after the pulse creation completes successfully (after `setPulseCreatedId`).

This ensures `ProjectsContext` re-queries all projects/dashboards/pulses immediately, and the sidebar re-renders with the new pulse visible.

## Files Changed

- `src/pages/QueryManager/index.tsx` — Added `refetchProjects` call after pulse creation
