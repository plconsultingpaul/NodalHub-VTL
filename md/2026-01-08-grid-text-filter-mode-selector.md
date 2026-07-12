# Grid Text Filter Mode Selector

**Date:** 2026-01-08

## Summary

Added a filter mode selector dropdown prefix to the "Type to filter" text input in grid column headers. This allows users to choose different filtering methods such as Contains, Starts With, Ends With, Equals, Not Contains, and Not Equals.

## Changes Made

### File: `src/pages/DashboardViewer/DashboardCell.tsx`

1. **Added filter mode state tracking:**
   - New `columnFilterModeState` Map to store selected filter mode per column
   - New `FILTER_MODES` constant array defining available filter modes with id, label, and short code

2. **Added filter mode dropdown prefix UI:**
   - A small button prefix before the text input showing the current mode (C, S, E, =, !C, !=)
   - Clicking the button reveals a dropdown menu with all available filter modes
   - Each mode shows both the short code and full label

3. **Updated filter application logic:**
   - The `applyFilter` function now reads the selected filter mode
   - Applies the appropriate Tabulator filter type based on mode:
     - Contains: `like` filter
     - Starts With: `starts` filter
     - Ends With: `ends` filter
     - Equals: `=` filter
     - Not Contains: custom function filter
     - Not Equals: `!=` filter

4. **Updated clear filter functionality:**
   - Clear icon now resets the filter mode back to "Contains"
   - Filter mode state is cleared when Tabulator is reinitialized

## Filter Modes Available

| Short | Label | Description |
|-------|-------|-------------|
| C | Contains | Matches if the cell value contains the search term (default) |
| S | Starts With | Matches if the cell value starts with the search term |
| E | Ends With | Matches if the cell value ends with the search term |
| = | Equals | Matches if the cell value exactly equals the search term |
| !C | Not Contains | Matches if the cell value does NOT contain the search term |
| != | Not Equals | Matches if the cell value does NOT equal the search term |

## Usage

1. Click the mode button (showing "C" by default) next to any column's text filter input
2. Select the desired filter mode from the dropdown
3. Type your filter value in the text input
4. The filter is applied using the selected mode
5. Hover over the mode button to see the current mode's full name in the tooltip
