# User Parameters Feature

**Date:** 2026-01-07

## Overview

Added the ability to define user parameters on queries that prompt users for values at runtime when viewing dashboards.

## Changes Made

### Database

- Added `user_parameters` JSONB column to `queries` table
- Structure: `[{ "name": "@ParamName", "prompt": "Enter value", "dataType": "Text|Date|Integer|Double|Boolean" }]`

### Types (`src/types/database.ts`)

- Added `UserParameterDataType` type: `'Text' | 'Date' | 'Integer' | 'Double' | 'Boolean'`
- Added `UserParameter` interface with `name`, `prompt`, and `dataType` fields
- Updated `queries` table type to include `user_parameters` column

### Query Manager (`src/pages/QueryManager/ApiEndpointQueryForm.tsx`)

- Added "User Parameters" section with:
  - Add Parameter button
  - Parameter name input (auto-prefixed with @)
  - Prompt text input
  - Data Type dropdown (Text, Date, Integer, Double, Boolean)
  - Delete button for each parameter
- User parameters are saved with the query

### Dashboard Viewer (`src/pages/DashboardViewer/index.tsx`)

- Added parameter prompt modal that appears when dashboard has queries with user parameters
- Modal displays appropriate input types based on data type:
  - **Text**: Standard text input
  - **Integer**: Number input (whole numbers only)
  - **Double**: Number input (decimals allowed)
  - **Boolean**: Yes/No radio buttons
  - **Date**: Date picker
- Modal requires valid values before allowing continuation
- Parameter values are passed to dashboard cells

### Dashboard Cell (`src/pages/DashboardViewer/DashboardCell.tsx`)

- Added `parameterValues` prop to receive user-provided values
- Added `substituteUserParameters` function to replace @parameter references with actual values
- Parameter substitution occurs in both `query_parameters` values and `url_query_string`

### Modal Component (`src/components/ui/Modal.tsx`)

- Added `hideCloseButton` prop to prevent closing the parameter prompt modal

## Usage

1. In Query Manager, create or edit a query
2. In the "User Parameters" section, click "Add Parameter"
3. Enter the parameter name (e.g., @Status), prompt text, and select data type
4. Use the parameter name in filter values (e.g., in $filter: `status eq @Status`)
5. When opening a dashboard with this query, users will be prompted to enter values
6. The entered values replace the parameter placeholders in the API request

## Data Type Validation

- **Text**: Any non-empty string
- **Integer**: Must match pattern `/^-?\d+$/`
- **Double**: Must match pattern `/^-?\d*\.?\d+$/`
- **Boolean**: Must be "true" or "false"
- **Date**: Uses native date picker, value in YYYY-MM-DD format
