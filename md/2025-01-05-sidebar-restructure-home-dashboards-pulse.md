# Sidebar Restructure: Home, Dashboards, Pulse Sections

**Date:** 2025-01-05

## Summary

Restructured the sidebar navigation to have three top-level items: Home, Dashboards, and Pulse. Each section (Dashboards and Pulse) contains its own project folders that expand to show dashboards.

## Changes Made

### Database Migration

**File:** `supabase/migrations/20260105_add_project_type_column.sql`

- Added `type` column to `projects` table with values `'dashboards'` or `'pulse'`
- Default value is `'dashboards'` for backward compatibility
- Added check constraint to ensure only valid values

### Type Definitions

**File:** `src/types/database.ts`

- Added `type` field to Project Row, Insert, and Update interfaces
- Added `ProjectType` type export for reuse

### useProjects Hook

**File:** `src/hooks/useProjects.ts`

- Updated `createProject` function to accept optional `type` parameter
- Projects are now created with proper sort order within their type

### Sidebar Component

**File:** `src/components/layout/Sidebar.tsx`

- Replaced single "Projects" section with two expandable sections: "Dashboards" and "Pulse"
- Home button now collapses both sections when clicked
- Each section filters projects by type
- Added Activity icon for Pulse section
- Modal titles now reflect which section the project is being created in
- Dashboard creation modal filters projects by the active section type

## Behavior

| Action | Result |
|--------|--------|
| Click Home | Navigate to home, collapse Dashboards and Pulse sections |
| Click Dashboards | Expand/collapse Dashboards section |
| Click Pulse | Expand/collapse Pulse section |
| Click Project Folder | Expand/collapse to show dashboards inside |
| Click + (in section) | Show dropdown to create new project or dashboard |

## Files Modified

1. `supabase/migrations/` - New migration for type column
2. `src/types/database.ts` - Updated Project type with `type` field
3. `src/hooks/useProjects.ts` - Added type parameter to createProject
4. `src/components/layout/Sidebar.tsx` - Complete restructure with accordion sections
