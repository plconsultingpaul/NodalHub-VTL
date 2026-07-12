# Query Manager: Migrate Selects to CustomDropdown

**Date:** 2026-06-10

## Summary

Replaced all native `<select>` elements in the Edit Query form (ApiEndpointQueryForm) with the `CustomDropdown` component for visual consistency across the app. Also fixed the User Parameters "Data Type" dropdown being too narrow to display values like "DateTime (Fixed)".

## Changes

### `src/pages/QueryManager/ApiEndpointQueryForm.tsx`

**Dropdowns migrated:**
1. **API Endpoint** -- replaced native select with `CustomDropdown` (includes `autoWidth` for long endpoint labels)
2. **HTTP Method** -- replaced native select with `CustomDropdown`
3. **User Parameters: Data Type** -- replaced native select; uses `autoWidth` with `dropdownMinWidth={160}` so labels like "DateTime (Fixed)" display fully
4. **User Parameters: Target** -- replaced native select (Filter / Path)
5. **User Parameters: Fixed Value** -- replaced native select; uses `autoWidth`
6. **Request Body Field Mappings: Type** -- replaced native select (Hardcoded / Parameter)
7. **Request Body Field Mappings: Value** (parameter mode) -- replaced native select
8. **Request Body Field Mappings: Data Type** -- replaced native select (String / Integer / Double / Boolean / DateTime)
9. **Filter Operator** (in field picker modal) -- replaced native select

**Grid width fix:**
- User Parameters grid template changed from `[1fr_1.5fr_120px_90px_120px_auto]` to `[1fr_1.5fr_150px_100px_130px_auto]`
- Data Type column widened from 120px to 150px
- Target column widened from 90px to 100px
- Fixed Value column widened from 120px to 130px

## Notes

- No database changes required
- The sub-path searchable dropdown was already custom-built and was left as-is
