# Query Manager Feature

**Date:** 2026-01-05

## Overview

Added a new Query Manager page that allows users to create and manage reusable data queries. Queries can be used as data sources for widgets and reports.

## Changes Made

### Database

**New Table: `queries`**
- Stores query configurations for different data source types
- Supports three query types: API Endpoint, SQL (placeholder), Stored Procedure (placeholder)
- Linked to companies via `company_id`
- Can reference API endpoints and API spec endpoints for validation
- Stores query parameters, URL query strings, and JSON parameters
- Full RLS policies for secure access by company members

### Files Added

1. **`supabase/migrations/20260105_create_queries_table.sql`**
   - Creates the `queries` table with all columns
   - Sets up RLS policies for SELECT, INSERT, UPDATE, DELETE
   - Creates performance indexes

2. **`src/types/database.ts`**
   - Added `Query` type definition
   - Added `QueryType` type for query categories
   - Added `QueryWithRelations` type for queries with joined data

3. **`src/hooks/useQueries.ts`**
   - CRUD operations for queries
   - `getSpecEndpointsForEndpoint` - Fetches API spec endpoints for a given API endpoint
   - `getFieldsForSpecEndpoint` - Fetches parameter fields for a spec endpoint
   - `testQuery` - Executes a test call to the configured API
   - `buildFullUrl` - Constructs the full URL with parameters

4. **`src/pages/QueryManager/index.tsx`**
   - Main page component with query list table
   - Create/Edit modal with type selection
   - Delete confirmation modal
   - Empty state for no queries

5. **`src/pages/QueryManager/ApiEndpointQueryForm.tsx`**
   - Form for configuring API Endpoint type queries
   - Endpoint selection dropdown
   - HTTP method selection
   - API sub-path selection from spec or manual entry
   - Query parameters table with enable/disable checkboxes
   - URL query string input
   - JSON parameters input
   - Show Full URL preview
   - Test Connection functionality with response display

### Files Modified

1. **`src/components/layout/Sidebar.tsx`**
   - Added Database icon import
   - Added Query Manager link above Settings

2. **`src/App.tsx`**
   - Added QueryManager import
   - Added `/query-manager` route

## Features

### API Endpoint Query Type
- Select from configured API endpoints for the company
- Choose HTTP method (GET, POST, PUT, PATCH, DELETE)
- Select API sub-path from uploaded API specification or enter manually
- Auto-populate query parameters from API spec with:
  - Type badges (string, integer, array)
  - Description tooltips
  - Example values
  - Enable/disable checkboxes
- Clear All / Fill Examples buttons for parameters
- URL Query String for complex parameters (OData filters, etc.)
- JSON Parameters for request body
- Show Full URL preview
- Test Connection with response display

### SQL Query Type (Placeholder)
- Coming soon indicator in UI

### Stored Procedure Type (Placeholder)
- Coming soon indicator in UI

## UI Location

The Query Manager is accessible from the sidebar, positioned above the Settings link with a Database icon.
