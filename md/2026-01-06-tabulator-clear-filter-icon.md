# Tabulator Clear Filter Icon

**Date:** 2026-01-06

## Summary

Added a clear filter icon (X) next to the filter icon in Tabulator column headers. Clicking this icon resets all filters for that column, including both dropdown selections and text input filters.

## Changes Made

### File: `src/pages/DashboardViewer/DashboardCell.tsx`

1. **Added `CLEAR_ICON_SVG` constant** - An X icon SVG matching the style of the existing filter icon

2. **Created `clearIcon` button element** - Added after the filter icon in the title row with:
   - Hidden by default (`display: none`)
   - Same styling as filter icon (3px padding, transparent background, gray color)
   - Tooltip text "Clear filter"

3. **Appended `clearIcon` to `titleRow`** - Positioned after the filter icon

4. **Updated `updateFilterIcon` function** - Now toggles clear icon visibility:
   - Shows clear icon (`display: flex`) when any filter is active
   - Hides clear icon (`display: none`) when no filters are active

5. **Added `clearIcon.onclick` handler** - When clicked:
   - Clears `columnFilterState` for the field (sets to empty Set)
   - Clears `columnTextFilterState` for the field (sets to empty string)
   - Clears the text input element's displayed value
   - Removes all Tabulator filters for that specific column
   - Updates the filter icon appearance

6. **Added hover effects for `clearIcon`**:
   - On hover: red background (#fee2e2) and red color (#dc2626)
   - On leave: transparent background and gray color (#6b7280)

## Behavior

- The clear icon only appears when a column has an active filter (dropdown or text)
- Clicking the clear icon resets both filter types for that column
- The filter icon returns to its inactive state after clearing
- Hover state provides visual feedback (red tint) to indicate destructive action
