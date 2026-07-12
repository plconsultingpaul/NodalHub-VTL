# Dashboard User Parameters Fetch Fix

**Date:** 2026-01-07

## Problem

When opening a dashboard that contained queries with User Parameters, the parameter prompt modal was not appearing. The dashboard would execute the query without substituting parameter values, resulting in empty or incorrect results.

## Root Cause

The `useDashboardConfig` hook was not fetching the `user_parameters` column from the `queries` table. The select statements only included:

```
queries (id, name, query_type, api_endpoint_id, api_sub_path, http_method, query_parameters, url_query_string, json_parameters)
```

The `user_parameters` field was missing, so when the DashboardViewer checked for parameters to prompt, it always found none.

## Solution

Added `user_parameters` to both select statements in `useDashboardConfig.ts`:

1. Main cells query (line 33)
2. Drilldowns query (line 58)

## Files Changed

- `src/hooks/useDashboardConfig.ts` - Added `user_parameters` to both Supabase select statements
