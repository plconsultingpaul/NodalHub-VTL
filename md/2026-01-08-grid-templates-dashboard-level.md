# Grid Templates - Dashboard-Level Architecture

**Date:** 2026-01-08

## Summary

Changed grid templates from per-cell storage to per-dashboard storage. A single template now stores column configurations and formatting rules for ALL cells in a dashboard, allowing users to save and switch between dashboard-wide layouts.

## Problem

Previously, templates were stored per-cell (`dashboard_cell_id`), meaning:
- Each cell had its own independent templates
- The template dropdown only showed templates for the "active" cell
- Users couldn't save/restore the entire dashboard layout at once
- Confusing UX where templates appeared cell-specific

## Solution

Templates are now stored per-dashboard (`dashboard_id`), with nested structures for cell-specific configs:

### Database Changes

**Migration:** `change_grid_templates_to_dashboard_level`

- Changed `grid_templates.dashboard_cell_id` to `grid_templates.dashboard_id`
- Updated foreign key to reference `dashboards` table
- Updated all RLS policies for dashboard-based access
- Updated trigger for single default per dashboard
- Deleted existing per-cell templates (orphaned data)

### Type Changes

**New Types:**
- `GridTemplateCellColumnConfig` - Column config for a single cell
- `GridCellFormattingRules` - Formatting rules for a single cell

**Updated Types:**
- `GridTemplateColumnConfig` - Now contains `{ cells: Record<string, GridTemplateCellColumnConfig> }`
- `GridFormattingRules` - Now contains `{ cells: Record<string, GridCellFormattingRules> }`
- `GridTemplate` - Changed `dashboard_cell_id` to `dashboard_id`

### Hook Changes (`useGridTemplates`)

- Parameter changed from `cellId` to `dashboardId`
- `createTemplate()` now accepts both column config and formatting rules
- `updateTemplate()` now accepts optional formatting rules
- All queries use `dashboard_id` instead of `dashboard_cell_id`

### Component Changes

**DashboardViewer:**
- Single `selectedTemplateId` state instead of per-cell `selectedTemplates`
- Single `hasColumnChanges` boolean flag
- `handleSave()` collects configs from ALL cells
- `handleSaveAs()` creates dashboard-wide snapshot
- `handleTemplateChange()` no longer takes cellId
- `getActiveTemplateForCell(cellId)` extracts cell-specific config from template
- `getFormattingRulesForCell(cellId)` extracts cell-specific rules from template

**DashboardCell:**
- Props now use cell-specific types: `GridTemplateCellColumnConfig` and `GridCellFormattingRules`
- `getColumnConfig()` return type updated

**GridFormattingModal:**
- Props now use `GridCellFormattingRules` type

## Files Changed

1. `supabase/migrations/20260108*_change_grid_templates_to_dashboard_level.sql` - Database migration
2. `src/types/database.ts` - Type definitions
3. `src/hooks/useGridTemplates.ts` - Hook implementation
4. `src/pages/DashboardViewer/index.tsx` - Main dashboard viewer
5. `src/pages/DashboardViewer/DashboardCell.tsx` - Cell component
6. `src/pages/DashboardViewer/GridFormattingModal.tsx` - Formatting modal

## Usage

Templates now apply to the entire dashboard:
1. Make column/formatting changes to any cell
2. Click "Save" to update the current template (saves ALL cells)
3. Click "Save As" to create a new template snapshot
4. Use the dropdown to switch between different dashboard layouts
