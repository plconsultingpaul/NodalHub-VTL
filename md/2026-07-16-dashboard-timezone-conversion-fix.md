# 2026-07-16 Dashboard Timezone Conversion Fix

## Problem

Timestamps in dashboard grids were displaying shifted times. For example, a value that should show `2:10 pm` was displaying as `6:10 pm` (a +4 hour shift corresponding to UTC offset from Eastern time).

## Root Cause

The external API (Nodal Connect) serializes datetime values as **UTC ISO strings** (e.g., `2026-07-17T18:10:00.000Z`). The original local time stored in the database is `14:10` (2:10 PM Eastern), but the API converts it to `18:10 UTC` before returning it.

The `parseRawDate` function in `dateFormat.ts` was extracting the hour/minute digits directly from the ISO string without considering the `Z` (UTC) suffix, so it displayed the UTC time as-is instead of converting back to the company's timezone.

## Fix

1. **`src/lib/dateFormat.ts`** -- Added a `timezone` parameter to `formatDateValue()`. When the input string has a timezone indicator (`Z` or `+/-` offset) AND a target timezone is provided, the function uses `Intl.DateTimeFormat` with the company's IANA timezone to extract the correct local date/time parts before formatting. Reuses the same `TZ_ALIASES` mapping already used in `cronNext.ts`.

2. **`src/pages/DashboardViewer/DashboardCell.tsx`** -- Added `companyTimezone` prop. Both the main cell formatter and the drilldown formatter now pass this timezone to `formatDateValue()`.

3. **`src/pages/DashboardViewer/index.tsx`** -- Passes `activeCompany?.default_timezone` as the `companyTimezone` prop to each `<DashboardCell>`.

4. **Removed all debug `console.log` statements** from `DashboardCell.tsx` and `DashboardViewer/index.tsx`.

## Behavior After Fix

- ISO timestamps with `Z` suffix are converted from UTC to the company's configured `default_timezone` before display
- Timestamps without timezone indicators (raw strings like `07/17/2026 14:10:00`) are displayed as-is with no conversion
- If no company timezone is set, defaults to `UTC` (no shift)
