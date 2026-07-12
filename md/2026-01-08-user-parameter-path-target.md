# User Parameter Path Target Feature

## Date: 2026-01-08

## Summary
Added the ability for User Parameters in the Query Manager to target URL path parameters (e.g., `{vendorId}`) in addition to query/filter values.

## Problem
When creating a query with an API sub-path containing path parameters like `vendors/{vendorId}/contacts`, there was no way to pass User Parameter values into those path placeholders. User Parameters could only be used for filter/query string values.

## Solution
Added a "Target" field to User Parameters with two options:
- **Filter** (default): Substitutes the parameter value in query string/filter values (existing behavior)
- **Path**: Substitutes the parameter value in URL path parameters (e.g., `{vendorId}` becomes the actual vendor ID)

## Changes Made

### 1. Type Definition (`src/types/database.ts`)
- Added `UserParameterTarget` type: `'filter' | 'path'`
- Added optional `target` field to `UserParameter` interface

### 2. Query Manager Form (`src/pages/QueryManager/ApiEndpointQueryForm.tsx`)
- Added Target dropdown column to User Parameters grid
- Updated grid layout to accommodate the new column
- Added handler for target field updates
- Updated help text to explain the Target options

### 3. Dashboard Cell (`src/pages/DashboardViewer/DashboardCell.tsx`)
- Added `substitutePathParameters` function that:
  - Filters user parameters where `target === 'path'`
  - Replaces `{paramName}` placeholders in the URL path with the parameter value
  - Uses case-insensitive matching for path parameter names
- Updated `executeQuery` to call path substitution before building the final URL

## Usage
1. Create a query with an API sub-path containing path parameters (e.g., `vendors/{vendorId}/contacts`)
2. Add a User Parameter with name `@vendorId`
3. Set the Target to "Path"
4. At runtime, the user will be prompted for the vendor ID, and it will be substituted into the URL path
