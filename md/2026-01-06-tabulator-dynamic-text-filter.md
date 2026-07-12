# Tabulator Dynamic Text Input Filter

**Date:** 2026-01-06

## Summary

Added a dynamic text input filter to Tabulator column headers that works alongside the existing multi-select dropdown filter. Users can now type directly into a filter input below each column header to filter rows as they type, and both filter types combine with AND logic.

## Changes Made

### File: `src/pages/DashboardViewer/DashboardCell.tsx`

1. **Added text filter state tracking**
   - New `columnTextFilterState` Map to store text filter values per column

2. **Modified column header layout**
   - Changed container from single row to column layout
   - Title and filter icon remain in top row
   - Added text input field below the title row

3. **Updated filter application logic**
   - `applyFilter()` now applies both multi-select and text filters
   - Text filter uses Tabulator's `like` filter for substring matching
   - Both filters combine with AND logic

4. **Updated filter icon indicator**
   - Filter icon now shows active state when either filter type is active
   - Hover states respect both filter types

5. **Added text input event handlers**
   - `oninput` handler updates state and applies filter in real-time
   - `onclick` handler prevents event propagation

## Usage

- **Multi-select dropdown**: Click the filter icon to select specific values from a list
- **Text input filter**: Type directly in the input field below the column title to filter by substring
- **Combined filtering**: Use dropdown on one column and text filter on another - both filters apply together
