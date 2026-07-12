# API Spec Viewer Modal

## Overview

Replaced the raw JSON viewer modal with a full-featured API Specification Viewer that displays endpoints and fields in a two-panel layout.

## Changes Made

### File Modified
- `src/pages/Settings/ApiSettings.tsx`

### New Features

**Two-Panel Layout**
- Left panel displays available endpoints from the uploaded API specification
- Right panel displays fields for the selected endpoint

**Left Panel - Endpoints**
- Search input to filter endpoints by path or description
- HTTP method filter buttons (ALL, GET, POST, PUT, PATCH, DELETE)
- Color-coded method badges (GET=blue, POST=green, PUT=yellow, PATCH=orange, DELETE=red)
- Selected endpoint highlighted with blue ring

**Right Panel - Fields**
- Field count displayed in header
- Search input to filter fields
- Type filter buttons (ALL, PARAMS, BODY, RESPONSE)
- Each field displays:
  - Field path (e.g., `[query] $filter`, `[response] appointments`)
  - Data type badge (string, integer, array, boolean, object)
  - Required badge if applicable
  - Description, format, and example values

**Footer**
- Download button to export the original spec
- Close button

### State Management Added
- `viewingEndpoints` - List of endpoints from selected spec
- `selectedSpecEndpointId` - Currently selected endpoint
- `selectedEndpointFields` - Fields for selected endpoint
- `endpointSearchQuery` - Search filter for endpoints
- `methodFilter` - HTTP method filter
- `fieldSearchQuery` - Search filter for fields
- `fieldTypeFilter` - Field type filter (PARAMS/BODY/RESPONSE)
- `loadingEndpoints` - Loading state for endpoints fetch
- `loadingFields` - Loading state for fields fetch

### Functions Added
- `handleViewSpec()` - Opens viewer and fetches endpoints from `api_spec_endpoints` table
- `handleSelectEndpoint()` - Fetches fields from `api_endpoint_fields` table
- `closeViewer()` - Resets all viewer state
- `getMethodBadgeClasses()` - Returns color classes for HTTP method badges
- `getFieldTypeBadgeClasses()` - Returns color classes for field type badges

### Data Flow
1. Click Eye icon on spec card
2. Modal opens, fetches endpoints from database
3. Click an endpoint in left panel
4. Right panel loads and displays fields for that endpoint
5. Both panels support independent search and filtering
