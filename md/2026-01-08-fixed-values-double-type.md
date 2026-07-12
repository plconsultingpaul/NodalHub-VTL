# Fixed Values: Add Double Type

**Date:** 2026-01-08

## Summary

Added "Double" as a new Fixed Value type to support decimal numbers. Previously, the system used "Integer" with a sub-type selector for "Integer" vs "Non-Integer (Decimal)". Now, Integer and Double are separate, distinct types.

## Changes Made

### 1. Type Definitions (`src/types/database.ts`)

- Added `'double'` to `FixedValueType` union type
- Changed `'Non-Integer (Fixed)'` to `'Double (Fixed)'` in `UserParameterDataType`
- Removed `FixedValueIntegerConfig` interface (no longer needed since integer/double are separate types)
- Updated `FixedValue.config` type to remove `FixedValueIntegerConfig`

### 2. Fixed Values Modal (`src/pages/QueryManager/FixedValuesModal.tsx`)

- Added "Double" to `TYPE_CONFIG` with teal color styling
- Added "Double" to `FILTER_OPTIONS` dropdown
- Added "Double" button to the create buttons row (teal themed)

### 3. Fixed Value Editor (`src/pages/QueryManager/FixedValueEditor.tsx`)

- Removed `FixedValueIntegerConfig` import
- Removed `renderIntegerFields()` function (which contained the Integer/Non-Integer dropdown)
- Removed the call to `renderIntegerFields()` in the render section
- Updated single value input to handle both `integer` and `double` types:
  - Integer: `type="number"` with `step="1"`
  - Double: `type="number"` with `step="any"`
- Updated list value input with same handling
- Updated placeholder text for double type ("0.00")

### 4. API Endpoint Query Form (`src/pages/QueryManager/ApiEndpointQueryForm.tsx`)

- Changed `'Non-Integer (Fixed)'` to `'Double (Fixed)'` in `USER_PARAM_DATA_TYPES` array
- Updated `FIXED_TYPE_TO_VALUE_TYPE` mapping: `'Double (Fixed)'` now maps to `'double'`

## Behavior

- **Integer**: Whole numbers only (step="1")
- **Double**: Decimal numbers (step="any", allows any decimal precision)

## UI Appearance

| Type | Button Color | Badge Color |
|------|-------------|-------------|
| Date | Blue | Blue |
| DateTime | Green | Green |
| Integer | Amber | Amber |
| Double | Teal | Teal |
| Text | Slate | Slate |
