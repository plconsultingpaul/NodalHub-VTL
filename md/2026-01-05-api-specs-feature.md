# API Specs Feature Implementation

**Date:** 2026-01-05

## Summary

Added the API Specifications feature to the API Settings page. Users can now upload, manage, and view Swagger/OpenAPI specification files (JSON or YAML format).

## Changes Made

### 1. Database Migration

Created new tables to store API specifications:

- **`api_specs`** - Stores uploaded specification files and metadata
  - Links to `api_endpoints` via foreign key
  - Stores full spec content as JSONB
  - Tracks name, version, description, file name, endpoint count

- **`api_spec_endpoints`** - Stores parsed endpoint definitions
  - Path, method, summary
  - Parameters, request body, responses as JSONB

- **`api_endpoint_fields`** - Stores extracted field definitions
  - Field name, path (with prefix like `[query]`, `[body]`, `[response]`)
  - Type, required flag, description, example, format

RLS policies restrict access to company members only.

### 2. New Hook: useApiSpecs

Created `src/hooks/useApiSpecs.ts` with:

- `specs` - List of uploaded specifications
- `loading` - Loading state
- `uploadSpec(file, apiEndpointId)` - Upload and parse a spec file
- `deleteSpec(specId)` - Delete a specification
- `downloadSpec(spec)` - Download spec as JSON file
- `refetch()` - Refresh the specs list

Includes OpenAPI/Swagger parsing logic that extracts:
- Endpoints from the `paths` section
- Parameters (query, path, header)
- Request body fields
- Response body fields
- Handles `$ref` references

### 3. TypeScript Types

Added to `src/types/database.ts`:

- `ApiSpec`
- `ApiSpecEndpoint`
- `ApiEndpointField`
- `ApiSpecWithEndpoint`

### 4. UI Updates to ApiSettings.tsx

Updated the API Specs tab with:

- Filter dropdown to filter specs by API endpoint
- "Upload Spec" button
- Spec cards showing:
  - Name with version badge
  - Base API URL badge
  - File name, upload date, endpoint count
  - Description (truncated)
  - Action buttons: View, Download, Delete

- Upload modal with:
  - API endpoint selector (optional)
  - File upload zone (drag and drop)
  - File validation (JSON/YAML, max 10MB)

- View modal showing raw specification JSON

### 5. Dependencies

Added `js-yaml` package for YAML file parsing.

## Files Created

- `src/hooks/useApiSpecs.ts`
- `supabase/migrations/[timestamp]_create_api_specs_tables.sql`

## Files Modified

- `src/types/database.ts` - Added new types
- `src/pages/Settings/ApiSettings.tsx` - Added API Specs functionality
- `package.json` - Added js-yaml dependency

## Usage

1. Navigate to Settings > API Settings > API Specs tab
2. Click "Upload Spec" to upload a new specification
3. Optionally link the spec to a configured API endpoint
4. Select a JSON or YAML file (OpenAPI 3.0+ or Swagger 2.0)
5. View uploaded specs, download them, or delete them
6. Use the filter dropdown to show specs for a specific API endpoint
