# Request Body and Field Mappings for Query Manager

**Date:** 2026-01-10

## Summary

Added the ability to define a JSON request body when creating queries for POST, PUT, or PATCH API calls. Includes a "Map JSON" button that extracts all fields from the JSON template and allows configuring each field as either hardcoded or mapped to a user parameter.

## Changes Made

### 1. Database Migration

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_request_body_to_queries.sql`

Added two new columns to the `queries` table:
- `request_body_template` (text) - Raw JSON template for the request body
- `request_body_field_mappings` (jsonb) - Array of field mapping configurations

### 2. Type Definitions (`src/types/database.ts`)

Added new types for request body field mappings:
- `RequestBodyFieldMappingType` - 'hardcoded' | 'parameter'
- `RequestBodyFieldDataType` - 'string' | 'integer' | 'double' | 'boolean' | 'datetime'
- `RequestBodyFieldMapping` interface with:
  - `fieldName` - JSON path to the field (e.g., "inputs.IBOOKING_NUMBER")
  - `type` - Whether the value is hardcoded or from a parameter
  - `value` - The static value or parameter name
  - `dataType` - The data type for proper conversion

Updated the queries table Row/Insert/Update types to include the new columns.

### 3. ApiEndpointQueryForm (`src/pages/QueryManager/ApiEndpointQueryForm.tsx`)

**New State Variables:**
- `requestBodyTemplate` - Stores the JSON template string
- `requestBodyFieldMappings` - Array of field mapping configurations
- `jsonParseError` - Stores JSON parse error messages

**New Functions:**
- `generateRequestBodyFieldMappings()` - Parses JSON template and extracts all leaf fields
- `handleUpdateFieldMapping()` - Updates a field mapping at a specific index
- `handleRemoveFieldMapping()` - Removes a field mapping
- `handleAddFieldMapping()` - Manually adds a new field mapping

**UI Changes:**
- Added Request Body section (visible only for POST/PUT/PATCH methods)
- JSON template textarea with syntax error display
- "Map JSON" button to auto-extract fields
- Field Mappings table with columns:
  - Field Name (editable input)
  - Type (dropdown: Hardcoded/Parameter)
  - Value (text input for hardcoded, dropdown for parameter selection)
  - Data Type (dropdown: String/Integer/Double/Boolean/DateTime)
  - Delete button
- "+ Add Field" button for manual field additions

### 4. DashboardCell (`src/pages/DashboardViewer/DashboardCell.tsx`)

**New Function:**
- `buildRequestBody()` - Constructs the request body from template and field mappings:
  - Parses the JSON template
  - Iterates through field mappings
  - Resolves parameter values from runtime parameter values
  - Converts values to appropriate data types
  - Sets nested values at the correct JSON paths

**Updated Fetch Logic:**
- For POST/PUT/PATCH requests, builds the request body and includes it in the fetch call
- Logs the request body for debugging

## Usage Flow

1. Select POST, PUT, or PATCH as the HTTP method
2. Enter a JSON template in the Request Body textarea
3. Click "Map JSON" to extract all fields
4. For each field mapping:
   - Leave as "Hardcoded" and enter a static value, OR
   - Change to "Parameter" and select from available user parameters
5. Save the query
6. When the query executes, the request body is built with resolved values

## Example

**JSON Template:**
```json
{
  "name": "assignBooking",
  "inputs": {
    "IBOOKING_NUMBER": "AAAAAA",
    "IORIG_TERMINAL": "AAAAAA"
  }
}
```

**Generated Field Mappings:**
| Field Name | Type | Value | Data Type |
|------------|------|-------|-----------|
| name | Hardcoded | assignBooking | String |
| inputs.IBOOKING_NUMBER | Parameter | @bookingNum | String |
| inputs.IORIG_TERMINAL | Hardcoded | T001 | String |

## Query Manager Test with User Parameters

When clicking the Play button in the Query Manager to test a query that has user parameters defined, a modal now prompts for parameter values before running the test.

**Features:**
- Detects if query has user parameters
- Shows prompt modal with input fields for each parameter
- Pre-populates fixed value parameters when applicable
- Supports date picker for Date type parameters
- Substitutes parameter values in URL path, query string, and request body
- "Run Again" button also prompts for parameters

## Files Modified

1. `supabase/migrations/` - New migration for request_body columns
2. `src/types/database.ts` - Added RequestBodyFieldMapping types and updated Query type
3. `src/pages/QueryManager/ApiEndpointQueryForm.tsx` - Added Request Body UI section
4. `src/pages/QueryManager/index.tsx` - Added user parameter prompt modal for test functionality
5. `src/pages/DashboardViewer/DashboardCell.tsx` - Added request body building and sending
