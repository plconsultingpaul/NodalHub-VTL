# Fixed Values Integration with User Parameters

**Date:** 2026-01-07

## Overview

This change integrates Fixed Values with User Parameters in the Query Manager. Users can now link a User Parameter to a Fixed Value, allowing dashboards to present dropdown selections from predefined lists when prompting for parameter values.

## Changes Made

### 1. Database Types (`src/types/database.ts`)

- Extended `UserParameterDataType` to include fixed value types:
  - `Text (Fixed)`
  - `Date (Fixed)`
  - `DateTime (Fixed)`
  - `Integer (Fixed)`
  - `Non-Integer (Fixed)`
- Added `fixedValueId?: string` field to `UserParameter` interface

### 2. Query Manager - User Parameters Form (`src/pages/QueryManager/ApiEndpointQueryForm.tsx`)

- Added new data types to the Data Type dropdown
- Added a "Fixed Value" column to the user parameters grid
- When a Fixed data type is selected, shows a dropdown of available Fixed Values of matching type
- Fixed Values are filtered by type mapping:
  - `Text (Fixed)` -> text fixed values
  - `Date (Fixed)` -> date fixed values
  - `DateTime (Fixed)` -> datetime fixed values
  - `Integer (Fixed)` and `Non-Integer (Fixed)` -> integer fixed values

### 3. Dashboard Viewer - Parameter Prompt (`src/pages/DashboardViewer/index.tsx`)

- Fetches Fixed Values when dashboard loads
- Builds a map of fixed values used by parameters
- Pre-populates default values from Fixed Values when available
- Renders parameter inputs based on Fixed Value configuration:
  - **List type**: Shows a dropdown with all list items (value + description)
  - **Single value type**: Shows read-only input with the pre-set value
- Added validation support for fixed data types
- Added DateTime input type for `DateTime (Fixed)` parameters

## User Flow

1. In Query Manager, edit a query and add a User Parameter
2. Select a Fixed data type (e.g., "Text (Fixed)")
3. Choose a Fixed Value from the dropdown (e.g., "Driver Status")
4. Save the query
5. When launching a dashboard with this query:
   - If the Fixed Value is a list: User sees a dropdown to select from the predefined options
   - If the Fixed Value is a single value: The value is pre-filled and shown as read-only
   - Default values from the Fixed Value are automatically applied
