# 2026-07-18 Fixed Value List Prompt in Cell Actions

## Problem

When a dashboard cell action has a parameter mapping targeting a "Fixed Value" of list type (e.g., a list of drivers), right-clicking and selecting the action did not prompt the user to select from the list. Instead, it silently auto-resolved to the default/first value and executed immediately.

## Root Cause

`getPromptMappings()` only returned mappings with `target === 'prompt'` or `target === 'lookup'`. Fixed value list mappings (`target === 'fixed_value'` with `is_list: true`) were not included, so the prompt dialog never opened for them.

Additionally, `buildParamValues()` always called `resolveFixedValue(fv)` which auto-picks the default or first item -- it never checked if the user had provided a selection via `promptValues`.

## Fix

1. **`actionExecutor.ts`** -- Added `getFixedValueListMappings()` helper that identifies mappings targeting a list-type fixed value that requires user selection.

2. **`actionExecutor.ts`** -- Updated `buildParamValues()` to check `promptValues` first for list-type fixed values before falling back to auto-resolve.

3. **`DashboardCell.tsx`** -- At all three action execution points, now also collects fixed-value-list mappings and includes them in the prompt dialog alongside regular prompt/lookup mappings.

4. **`DashboardCell.tsx`** -- Added rendering case in the prompt dialog that shows a searchable `CustomDropdown` populated with the fixed value's `list_values`.

## Files Changed

- `src/pages/DashboardViewer/actionExecutor.ts` -- new `getFixedValueListMappings()` export + `buildParamValues()` updated to respect user selection for list-type fixed values
- `src/pages/DashboardViewer/DashboardCell.tsx` -- import + use `getFixedValueListMappings`, render `CustomDropdown` for list-type fixed values in prompt dialog
