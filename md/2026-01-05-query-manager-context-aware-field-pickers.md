# Query Manager Context-Aware Field Pickers

**Date:** 2026-01-05

## Summary

Added inline field picker buttons to each query parameter row in the Query Manager form. The field picker now displays different UI and behavior based on the parameter type being configured.

## Changes Made

### File Modified
- `src/pages/QueryManager/ApiEndpointQueryForm.tsx`

### New Features

1. **Inline Field Picker Buttons**
   - Each query parameter row now has a `{ }` button beside its value input
   - Button only appears for supported parameters ($filter, $orderBy, $select)
   - Integer parameters (limit, offset) do not show the button

2. **Context-Aware Picker Modes**

   **$filter Parameter:**
   - Two-step workflow: select field, then configure filter
   - Operator selection based on field type (string, number, boolean, date)
   - Value input with validation
   - Generates expressions like `fieldName eq 'value'` or `contains(fieldName, 'value')`
   - Multiple filters concatenated with ` and `

   **$orderBy Parameter:**
   - Two-step workflow: select field, then choose direction
   - Ascending/Descending toggle buttons
   - Generates field names with optional ` desc` suffix
   - Multiple sort fields separated by commas

   **$select Parameter:**
   - Single-step workflow with multi-select checkboxes
   - Select multiple fields at once
   - Shows selected fields preview
   - Generates comma-separated field list

3. **Smart Parameter Detection**
   - Recognizes parameters by name: `$filter`, `filter`, `$orderBy`, `orderby`, `$select`, `select`
   - Automatically determines which picker mode to use

### UI Changes

- Grid layout updated from 3 columns to 4 columns to accommodate inline buttons
- Removed global field picker button from header
- Each parameter has its own contextual picker access
- Empty placeholder maintains alignment for parameters without picker

## Output Examples

| Parameter | Input | Output |
|-----------|-------|--------|
| $filter | Select "status", eq, "active" | `status eq 'active'` |
| $filter | Select "count", gt, 100 | `count gt 100` |
| $orderBy | Select "lastName", Ascending | `lastName` |
| $orderBy | Select "createdAt", Descending | `createdAt desc` |
| $select | Check id, firstName, lastName | `id,firstName,lastName` |

## Bug Fix: URL Encoding for OData Parameters

### Issue
Commas in OData parameter values (like `$select=id,name,email`) were being URL-encoded as `%2C`, causing API requests to fail.

### Solution
Added `encodeParamValue` helper function in `src/hooks/useQueries.ts` that:
- Detects OData parameters by name ($select, $orderby, $filter, $expand)
- Preserves commas and spaces in OData parameter values
- Uses standard URL encoding for all other parameters
