# Fixed Values Feature

**Date:** 2026-01-07

## Overview

Added a new Fixed Values feature to the Query Manager page that allows users to create and manage reusable constant values of different types.

## Changes Made

### Database

- Created `fixed_values` table with:
  - `id`, `company_id`, `name`, `description`
  - `value_type` (date, datetime, integer, text)
  - `is_list` flag for single vs list mode
  - `single_value` for single value types
  - `list_values` (jsonb array) for list types
  - `default_value` and `is_editable` for list types
  - `config` (jsonb) for type-specific settings
  - RLS policies for company-based access

### New Files

1. **`src/hooks/useFixedValues.ts`**
   - CRUD operations for fixed values
   - `getFixedValuesByType` filter function

2. **`src/pages/QueryManager/FixedValuesModal.tsx`**
   - Main modal showing all fixed values
   - Type filter dropdown (All, Date, DateTime, Integer, Text)
   - Buttons to create each type
   - Table view with edit/delete actions

3. **`src/pages/QueryManager/FixedValueEditor.tsx`**
   - Editor modal for creating/editing fixed values
   - Type-specific fields:
     - **Date**: Base Date, String Format, Adjust Years/Months/Days, Sample Value preview
     - **DateTime**: Same as Date plus Adjust Hours/Minutes/Seconds
     - **Integer**: Numeric Type (Integer/Non-Integer), Single/List toggle
     - **Text**: Single/List toggle
   - List management: Add/Modify/Delete/Delete All, Sort Ascending/Descending, Move Up/Down, Default Value, Editable checkbox

### Modified Files

1. **`src/types/database.ts`**
   - Added `FixedValueType`, `FixedValueListItem`, `FixedValueDateConfig`, `FixedValueDateTimeConfig`, `FixedValueIntegerConfig`, `FixedValue` types

2. **`src/pages/QueryManager/index.tsx`**
   - Added "Fixed Values" button to the left of "New Query" dropdown
   - Integrated FixedValuesModal

## Fixed Value Types

### Date
- Base Date options: Today, First/Last Day of Month, First/Last Day of Year
- String Format options: MM/dd/yyyy, dd/MM/yyyy, yyyy-MM-dd, MMMM d, yyyy
- Adjustments: Years, Months, Days
- Live Sample Value preview

### DateTime
- Same as Date plus time adjustments
- Additional formats: MM/dd/yyyy HH:mm, ISO 8601
- Adjustments: Years, Months, Days, Hours, Minutes, Seconds

### Integer
- Numeric Type: Integer or Non-Integer (Decimal)
- Value Type: Single or List
- List features: Add/Edit/Delete items, Sort, Reorder, Default Value, Editable flag

### Text
- Value Type: Single or List
- List features: Same as Integer

## Bug Fix (2026-01-07)

Fixed an issue where newly created fixed values were not appearing in the list. The modal and editor were using separate hook instances, so the editor's save didn't trigger a refresh in the modal. Updated the editor to signal successful saves back to the modal, which then refreshes its data.
