# Dashboard Request Body Fetch Fix

**Date:** 2026-01-10

## Problem

Dashboard cells making POST requests to API endpoints were receiving "400 Bad Request - Invalid Request Body" errors. The request body was empty despite being configured in the Query Manager.

## Root Cause

The `useDashboardConfig.ts` hook was not fetching the `request_body_template` and `request_body_field_mappings` columns when loading queries for dashboard cells and drilldowns.

The query select was:
```
queries (id, name, query_type, api_endpoint_id, api_sub_path, http_method, query_parameters, url_query_string, json_parameters, user_parameters)
```

This meant the request body configuration was in the database but never loaded into the dashboard viewer.

## Solution

Added the missing columns to both query selects in `useDashboardConfig.ts`:

- `request_body_template` - The JSON template for the request body
- `request_body_field_mappings` - Array of field mappings for parameter substitution

## Files Changed

- `src/hooks/useDashboardConfig.ts` - Added `request_body_template, request_body_field_mappings` to both the dashboard cells query select (line 33) and the drilldowns query select (line 58)
