# Field Picker Cursor Context Feature

**Date:** 2026-01-05

## Summary

Modified the `{ }` (Braces) button in the Query Parameters section to be context-aware. The button now opens a searchable field picker modal only when a parameter value input field has focus.

## Changes Made

### File: `src/pages/QueryManager/ApiEndpointQueryForm.tsx`

1. **Added focus tracking state:**
   - `focusedParamIndex` - tracks which parameter input currently has focus
   - `showFieldPicker` - controls visibility of the field picker modal
   - `fieldPickerSearch` - search term for filtering fields
   - `paramInputRefs` - refs array to access input elements for cursor position

2. **New functions:**
   - `handleFieldPickerOpen()` - opens the field picker modal when a value input is focused
   - `handleFieldSelect(fieldName)` - inserts the selected field name at the cursor position in the focused input
   - `filteredPickerFields` - computed list of fields filtered by search term

3. **Updated parameter value inputs:**
   - Added `ref` to track each input element
   - Added `onFocus` handler to track which input has focus

4. **Updated Braces button:**
   - Now calls `handleFieldPickerOpen` instead of `handleViewResponseFields`
   - Disabled when no parameter input is focused
   - Tooltip indicates user should click a value field first when disabled

5. **Added searchable field picker modal:**
   - Modal overlay with search input at top
   - Displays field name, type, and description
   - Clicking a field inserts its name at the cursor position in the focused input
   - Returns focus to the input after selection

## Behavior

- Click on a parameter value input field (e.g., $filter)
- While that field has focus, click the `{ }` button
- A modal appears with searchable response fields
- Type to filter fields by name or description
- Click a field to insert its name at the cursor position
- Modal closes and focus returns to the input field
