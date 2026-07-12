# Drilldown Column Width Save - Debug Logging and Fix

**Date:** 2026-01-08

## Problem

When changing drilldown column widths and saving the template, the column widths revert to their original state immediately after clicking Save.

## Root Cause (Identified from Logs)

The logs revealed a timing issue:

1. `renderInlineDrilldown` had `activeTemplate` in its dependency array
2. When drilldown data fetched (or any state change), the `useEffect` would trigger
3. This caused `renderInlineDrilldown` to run BEFORE save was clicked
4. The drilldown was DESTROYED and recreated with the OLD template config
5. This overwrote the user's column resize
6. When save finally ran, `getColumnConfig` captured from the recreated drilldown

## Fix Applied

Changed `renderInlineDrilldown` to use `activeTemplateRef.current` instead of `activeTemplate` prop:

**Before:**
```typescript
const templateDrilldownConfig = activeTemplate?.drilldowns?.[drilldown.id];
// ...
}, [cell.drilldowns, handleDrilldownColumnChange, activeTemplate]);
```

**After:**
```typescript
const currentTemplate = activeTemplateRef.current;
const templateDrilldownConfig = currentTemplate?.drilldowns?.[drilldown.id];
// ...
}, [cell.drilldowns, handleDrilldownColumnChange]);
```

This prevents template changes from causing unnecessary drilldown recreations, preserving user's column resizes until they explicitly save.

## Debug Logging (Still Present)

Logging remains at key points for future debugging:

### 1. getColumnConfig() in DashboardCell.tsx

- `drilldownTabulatorsRef.current.size`
- `containerWidth`
- For each column: `field`, `pixelWidth`, `percentWidth`
- Final `drilldownConfigs` object

### 2. renderInlineDrilldown() in DashboardCell.tsx

- `drilldown.id` being rendered
- `activeTemplateRef.current?.drilldowns`
- `templateDrilldownConfig`
- `savedConfig`
- For each column: `field`, `tc.width`, `appliedWidth`

### 3. handleSave() in DashboardViewer/index.tsx

- Full `columnConfig` object
- For each cell with drilldowns: the drilldown configs

### 4. updateTemplate() in useGridTemplates.ts

- `templateId` being updated
- `columnConfig` being saved
- Confirmation when complete

## Files Modified

- `src/pages/DashboardViewer/DashboardCell.tsx`
  - Changed `renderInlineDrilldown` to use `activeTemplateRef.current`
  - Removed `activeTemplate` from dependency array
  - Added debug logging
- `src/pages/DashboardViewer/index.tsx` - Added logging to handleSave
- `src/hooks/useGridTemplates.ts` - Added logging to updateTemplate
