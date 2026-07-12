# Tabulator Multi-Select Header Filter

**Date:** 2026-01-06

## Summary

Added multi-select checkbox header filters to Tabulator tables in the Dashboard Viewer, allowing users to filter columns by selecting multiple values from a dropdown with checkboxes.

## Changes Made

### `src/pages/DashboardViewer/DashboardCell.tsx`

- Added `createMultiSelectHeaderFilter` function - a custom Tabulator header filter editor that creates:
  - A text input field with dropdown arrow
  - A dropdown panel containing a search input and checkbox list
  - "(Select All)" option at the top
  - Unique values auto-populated from column data
  - Search functionality to filter the options list
- Added `multiSelectHeaderFilterFunc` function - filters rows based on selected checkbox values
- Applied the custom header filter to all data columns

### `src/index.css`

- Added styles for the multi-select filter dropdown
- Added scrollbar styling for the dropdown
- Added dark mode support for the filter components

## Features

1. **Filter Input** - Shows "Filter..." placeholder, displays selected value count when filtering
2. **Dropdown Arrow** - Click to toggle the dropdown
3. **Search Box** - Type to search/filter the available options
4. **Select All** - Checkbox to select/deselect all values at once
5. **Checkboxes** - Individual checkboxes for each unique column value
6. **Multi-Select** - Select multiple values to show rows matching any of them
7. **Dark Mode** - Full support for dark mode styling

## Bug Fixes

### Dropdown z-index fix (2026-01-06)

Fixed issue where the filter dropdown was appearing behind the table rows:
- Changed `.tabulator` overflow from `hidden` to `visible`
- Added `overflow: visible` and `z-index: 10` to `.tabulator-header`
- Added `overflow: visible` to `.tabulator-header .tabulator-col`
- Added `overflow: auto` to `.tabulator-tableholder` to maintain scrolling
