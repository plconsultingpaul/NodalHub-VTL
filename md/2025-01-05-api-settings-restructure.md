# API Settings Restructure

**Date:** 2025-01-05

## Summary

Restructured the API configuration section in Settings. API Endpoints and API Specs are now sub-tabs within the API Settings page instead of separate top-level navigation items.

## Changes Made

### 1. Renamed "API Endpoints" to "API Settings" in Main Navigation
- Updated navigation label in SettingsLayout.tsx
- Changed icon from Link2 to Server

### 2. Simplified API Settings Form
Removed fields:
- HTTP Method dropdown (GET, POST, PUT, DELETE, PATCH)
- Custom Headers section

Kept fields:
- Name
- API URL
- Authentication Type (None, Bearer Token, API Key, Basic Auth)
- Authentication Value (varies based on type)

Added field:
- Health Endpoint (optional path for health checks)

### 3. Added Internal Tabs to API Settings Page
The API Settings page now contains three internal tabs:
- **API Settings** - Configure parent API URLs (editable)
- **API Endpoints** - View configured APIs (read-only)
- **API Specs** - Placeholder for future documentation

### 4. Removed Separate Pages
- Removed `/settings/endpoints` route
- Removed `/settings/api-specs` route
- Deleted `ApiEndpoints.tsx` and `ApiSpecs.tsx` files

### 5. Database Migration
- Added `health_endpoint` column to `api_endpoints` table
- Column is nullable text field

## Files Modified
- `src/pages/Settings/ApiSettings.tsx` - Added internal tabs and simplified form
- `src/pages/Settings/SettingsLayout.tsx` - Removed API Endpoints and API Specs from nav
- `src/App.tsx` - Removed separate routes
- `src/types/database.ts` - Added health_endpoint to ApiEndpoint type

## Files Deleted
- `src/pages/Settings/ApiEndpoints.tsx`
- `src/pages/Settings/ApiSpecs.tsx`
