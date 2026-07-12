# 2026-06-04 - Pulse Query Tab Custom Dropdown Migration

## Problem

The dropdown selectors in the Pulse Builder's Query tab were using native `<select>` HTML elements, which render with default browser styling (blue highlight, system font, no icons). These did not match the custom dropdown component spec used elsewhere in the application.

## Changes

### `src/pages/PulseBuilder/QueryTab.tsx`

Replaced all three native `<select>` elements with the `CustomDropdown` component:

1. **Query selector** - The main query picker at the top of the tab.
2. **Parameter fixed-value selector** - The dropdown shown when a query parameter is linked to a fixed value list (e.g., "Select Driver Status...").
3. **Group By Field selector** - The column picker shown when "Per Group" run mode is selected.

Each now uses the portal-rendered `CustomDropdown` with proper dark mode support (`isDark` from `ThemeContext`), matching the design spec: rounded-lg trigger, slate borders, blue-highlighted selected option with checkmark, chevron rotation on open.

### Added imports

- `CustomDropdown` from `../../components/ui/CustomDropdown`
- `useTheme` from `../../contexts/ThemeContext`
