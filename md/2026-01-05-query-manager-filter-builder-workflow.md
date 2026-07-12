# Query Manager Filter Builder Workflow

**Date:** 2026-01-05

## Summary

Enhanced the field picker modal in the Query Manager to include a filter builder workflow. When users select a field for filtering, they can now choose an operator and enter a value, with the system automatically generating the correct filter syntax.

## Changes Made

### File Modified
- `src/pages/QueryManager/ApiEndpointQueryForm.tsx`

### New Features

1. **Two-Step Field Selection Workflow**
   - Step 1: Select a field from the searchable list
   - Step 2: Configure the filter operator and value

2. **Filter Operator Selection**
   - Operators are context-aware based on field type:
     - **String fields**: Equals, Not Equals, Contains, Starts With, Ends With
     - **Numeric fields**: Equals, Not Equals, Greater Than, Greater Than or Equal, Less Than, Less Than or Equal
     - **Boolean fields**: Equals, Not Equals
     - **Date fields**: Equals, Not Equals, Greater Than, Greater Than or Equal, Less Than, Less Than or Equal

3. **Value Input with Validation**
   - Validates values based on field type
   - Numeric fields require numeric values
   - Boolean fields require true/false
   - Supports dynamic variables with `${variableName}` syntax

4. **Filter Expression Preview**
   - Shows real-time preview of the generated filter expression
   - Updates as operator and value change

5. **Proper Syntax Generation**
   - String values are wrapped in single quotes: `fieldName eq 'value'`
   - Numeric values are not quoted: `fieldName gt 100`
   - Boolean values are lowercase without quotes: `fieldName eq true`
   - Function-style operators: `contains(fieldName, 'value')`

6. **Smart Concatenation**
   - When adding to an existing filter, appends with ` and ` connector
   - Example: `status eq 'active' and isActiveInDispatch eq true`

## UI Flow

1. User clicks the field picker button (Braces icon)
2. Modal opens with searchable field list
3. User clicks a field (e.g., "isActiveInDispatch")
4. Modal switches to filter builder view showing:
   - Selected field with type badge
   - Filter operator dropdown
   - Value input field
   - Live preview of the expression
5. User selects operator and enters value
6. Clicks "Add Filter" to insert the expression

---

## Query Manager Grid Layout Update

### Additional File Modified
- `src/pages/QueryManager/index.tsx`

### Changes

1. **Moved API sub-path next to Endpoint name**
   - `/drivers` now displays inline beside "Xpress Master Data" in the Endpoint/Source column

2. **Single-line rows**
   - All content now fits on one line per row
   - Removed stacked layout in Name column

3. **Reduced row height**
   - Changed padding from `py-4` to `py-2`
   - Reduced badge padding from `py-1` to `py-0.5`
   - Reduced action button padding from `p-1.5` to `p-1`
   - More rows now visible on screen
