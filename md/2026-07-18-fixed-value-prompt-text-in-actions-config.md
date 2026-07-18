# 2026-07-18 Fixed Value Prompt Text in Cell Actions Config

## Problem

When configuring a cell action parameter mapping with target "Fixed Value" pointing to a list or lookup-type fixed value, there was no way to set a custom display label (prompt text). The prompt dialog would show the raw parameter name (e.g., `@IDRIVER_ID`) instead of a user-friendly label like "Select Driver".

The "Prompt Text" input field was only shown for "Prompt" and "Lookup" target types.

## Fix

1. **`ActionsConfigModal.tsx` (line ~222)** -- Updated the `promptText` preservation logic when changing targets to also include `'fixed_value'`, so the prompt text is not cleared when selecting that target.

2. **`ActionsConfigModal.tsx` (3 locations)** -- Added the "Display label" text input below the fixed value dropdown in all three parameter mapping sections (execute actions, popup actions, link actions). The input only appears when the selected fixed value is a list type (`is_list === true`) or a lookup type (`value_type === 'lookup'`).

## Files Changed

- `src/pages/DashboardViewer/ActionsConfigModal.tsx` -- show prompt text input for fixed_value mappings targeting list/lookup-type fixed values
