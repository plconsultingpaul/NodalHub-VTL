# Grid Templates Feature

**Date:** 2026-01-07

## Overview

Added the ability to create and manage Grid Templates for dashboard cells. Templates store column configurations including positions, widths, and custom names.

## Changes Made

### Database

- Created `grid_templates` table with the following columns:
  - `id` (uuid, primary key)
  - `dashboard_cell_id` (foreign key to dashboard_cells)
  - `name` (text) - template display name
  - `is_default` (boolean) - only one default per cell
  - `column_config` (jsonb) - stores column positions, widths, and titles
  - `formatting_rules` (jsonb) - placeholder for future formatting
  - `created_at`, `updated_at` timestamps
- Added RLS policies for authenticated users based on dashboard cell access
- Added trigger to ensure only one default template per cell

### New Files

- `src/hooks/useGridTemplates.ts` - Hook for CRUD operations on grid templates
- `src/pages/DashboardViewer/SaveTemplateModal.tsx` - Modal for naming new templates

### Modified Files

- `src/types/database.ts` - Added GridTemplate, GridTemplateColumn, and GridTemplateColumnConfig types
- `src/pages/DashboardViewer/DashboardCell.tsx`:
  - Added forwardRef with getColumnConfig method
  - Added activeTemplate prop to apply saved column configs
  - Added onColumnChange callback to track modifications
  - Columns now apply template positions, widths, and titles when a template is active
- `src/pages/DashboardViewer/index.tsx`:
  - Added template state management
  - Added Save button (saves to current/default template)
  - Added Save As button (creates new template with custom name)
  - Added template dropdown (visible when multiple templates exist)
  - Tracks column changes per cell

## Features

1. **Save**: Updates the currently selected template with current column configuration
2. **Save As**: Creates a new template with a user-provided name
3. **Template Dropdown**: Allows switching between templates when multiple exist
4. **Default Template**: Each cell can have one default template that loads automatically
5. **Column Tracking**: Positions, widths, and titles are preserved in templates

## Column Config Structure

```json
{
  "columns": [
    {
      "field": "original_field_name",
      "position": 0,
      "width": 150,
      "title": "Custom Display Name"
    }
  ]
}
```

## Bug Fixes

- Fixed Save/Save As buttons not appearing for dashboards opened from sidebar
- Template saving is now available to all users viewing a dashboard (column layout is a personal preference)

## Future Enhancements

- `formatting_rules` placeholder is ready for conditional formatting rules
- User-specific template defaults (planned for later implementation)
