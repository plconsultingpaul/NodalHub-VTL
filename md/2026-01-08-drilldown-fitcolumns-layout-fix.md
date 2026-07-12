# Drilldown Template Width Fix - fitColumns Layout

**Date:** 2026-01-08

## Problem

When drilldown tables had saved template widths (e.g., 32%, 23%, 45%), the columns displayed at tiny pixel widths instead (42px, 40px, 61px).

## Root Cause

The drilldown Tabulator was using `layout: 'fitData'`, which sizes columns based on data content first. Percentage widths applied with `fitData` are calculated relative to the minimum content width, not the container width.

## Solution

Changed the drilldown Tabulator to conditionally use `layout: 'fitColumns'` when saved template widths exist. The `fitColumns` layout properly respects percentage widths relative to the container.

- When columns have saved template widths: use `fitColumns`
- When no saved widths exist: use `fitData` (auto-size to content)

## File Changed

`src/pages/DashboardViewer/DashboardCell.tsx`

## Change Details

Added a check before Tabulator initialization:

```javascript
const hasTemplateSavedWidths = columns.some(col => col.width !== undefined);
// ...
layout: hasTemplateSavedWidths ? 'fitColumns' : 'fitData',
```

This is a targeted 2-line change that preserves default behavior while fixing percentage width rendering for templates.
