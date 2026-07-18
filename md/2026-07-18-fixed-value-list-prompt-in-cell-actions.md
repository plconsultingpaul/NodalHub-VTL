# 2026-07-18 Fixed Value List Prompt in Cell Actions

## Problem

When a dashboard cell action has a parameter mapping targeting a "Fixed Value" of list type (including lookup-type fixed values like "Canadian Tire Drivers"), right-clicking and selecting the action did not prompt the user to select from the list. Instead, it silently auto-resolved to the default/first value and executed immediately.

Additionally, for lookup-type fixed values, the dropdown was showing the raw value field (e.g., DRIVER_ID) instead of the label field (e.g., NAME).

## Root Cause

1. `getPromptMappings()` only returned mappings with `target === 'prompt'` or `target === 'lookup'`. Fixed value mappings (`target === 'fixed_value'`) were never included, so the prompt dialog never opened for them.

2. For lookup-type fixed values, `is_list` is stored as `false` in the database (by design in FixedValueEditor), so a simple `is_list` check would miss them.

3. `buildParamValues()` always called `resolveFixedValue(fv)` which auto-picks the default or first item -- it never checked if the user had provided a selection via the prompt dialog.

4. The lookup resolver (`useLookupResolver`) was not being triggered for fixed-value-list mappings when the prompt dialog opened.

## Fix

1. **`actionExecutor.ts`** -- Added `getFixedValueListMappings()` helper that identifies mappings targeting a list-type OR lookup-type fixed value that requires user selection.

2. **`actionExecutor.ts`** -- Updated `buildParamValues()` to check `promptValues` first for list/lookup-type fixed values before falling back to auto-resolve.

3. **`DashboardCell.tsx`** -- At all three action execution points, now collects fixed-value-list mappings and includes them in the prompt dialog alongside regular prompt/lookup mappings.

4. **`DashboardCell.tsx`** -- Added rendering case in the prompt dialog:
   - For lookup-type fixed values: triggers `resolveLookup()` on dialog open, shows a searchable `CustomDropdown` with label/value options from the lookup resolver (shows label names, submits values).
   - For regular list-type fixed values: shows a searchable `CustomDropdown` with `description` as label.

5. **`DashboardCell.tsx`** -- Updated the `useEffect` that resolves lookups on prompt dialog open to also trigger resolution for fixed-value lookup mappings.

## Files Changed

- `src/pages/DashboardViewer/actionExecutor.ts` -- new `getFixedValueListMappings()` export, `buildParamValues()` updated
- `src/pages/DashboardViewer/DashboardCell.tsx` -- import + use `getFixedValueListMappings`, resolve lookups for fixed-value mappings, render `CustomDropdown` for both lookup and regular list types
