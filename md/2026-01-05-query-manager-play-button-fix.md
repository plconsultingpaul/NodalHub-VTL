# Query Manager Play Button Fix

**Date:** 2026-01-05

## Issue

The play button (test icon) in the Query Manager table was not using the saved query parameters when testing a query. It would return all results from the API instead of applying the configured filters.

The "Test Connection" button inside the Edit Query modal worked correctly because it used the local form state. However, the play button in the table row used only the `url_query_string` fallback and ignored the `query_parameters` array.

## Root Cause

In `src/pages/QueryManager/index.tsx`, the `handleTest` function built the request URL using only:
- `endpoint.url`
- `query.api_sub_path`
- `query.url_query_string` (fallback)

It completely ignored the `query.query_parameters` field which contains the structured parameter data with enabled/disabled states and values.

## Solution

Modified the `handleTest` function to:
1. Extract `query_parameters` from the saved query
2. Filter to only enabled parameters that have values
3. Build a query string from those enabled parameters
4. Use the structured parameters as the primary source, falling back to `url_query_string` only when no structured parameters are enabled

## Changes Made

### `src/pages/QueryManager/index.tsx`

Updated the URL building logic in `handleTest`:

```typescript
const queryParams = query.query_parameters as Array<{ key: string; value: string; enabled: boolean }> | null;
const enabledParams = queryParams?.filter(p => p.enabled && p.value);

if (enabledParams && enabledParams.length > 0) {
  const paramString = enabledParams
    .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');
  url += (url.includes('?') ? '&' : '?') + paramString;
} else if (query.url_query_string) {
  url += (url.includes('?') ? '&' : '?') + query.url_query_string;
}
```

## Behavior After Fix

- Play button now uses saved query parameters (e.g., `$filter`, `$select`) when testing
- Only enabled parameters with values are included in the request
- Falls back to `url_query_string` if no structured parameters are configured
- Both the play button and "Test Connection" button now produce consistent results
