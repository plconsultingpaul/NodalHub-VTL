# Drilldown Column Changes Now Part of Dashboard Templates

**Date:** 2026-01-08

## Summary

Drilldown column configurations (resize, reorder) are now included in dashboard templates. When you adjust columns in a drilldown grid, the Save button highlights and changes are saved as part of the template.

## Problem

Previously, drilldown column changes were:
- Saved directly to the database (not part of templates)
- Not triggering the Save button to highlight
- Shared across all users/templates

## Solution

Drilldown column configs are now stored within the dashboard template structure, allowing per-template drilldown layouts.

### Type Changes

Added `GridTemplateDrilldownColumnConfig` type:
```typescript
export interface GridTemplateDrilldownColumnConfig {
  columns: GridTemplateColumn[];
}
```

Extended `GridTemplateCellColumnConfig` to include drilldowns:
```typescript
export interface GridTemplateCellColumnConfig {
  columns: GridTemplateColumn[];
  drilldowns?: Record<string, GridTemplateDrilldownColumnConfig>;
}
```

### Component Changes

**DashboardCell:**
- `getColumnConfig()` now collects column configs from all active drilldown tabulators
- Drilldown column/resize events now call `onColumnChange()` to notify parent
- When rendering drilldowns, template config is prioritized over stored config
- Removed direct database saves for drilldown column changes

## Files Changed

1. `src/types/database.ts` - Added drilldowns to template type
2. `src/pages/DashboardViewer/DashboardCell.tsx` - Updated to track and apply drilldown configs

## Behavior

1. Expand a row to show drilldown data
2. Resize or reorder drilldown columns
3. Save button highlights in the header
4. Click Save to persist to the current template
5. Switch templates to see different drilldown layouts
