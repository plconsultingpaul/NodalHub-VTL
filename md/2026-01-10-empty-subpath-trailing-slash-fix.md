# Empty Subpath Trailing Slash Fix

**Date:** 2026-01-10

## Problem

When executing API queries from a dashboard cell where the `api_sub_path` was empty, the system was incorrectly appending a trailing slash to the URL.

For example:
- Base URL: `https://honcdata.tmwcloud.com/jdata/executables/run`
- Subpath: `` (empty)
- Result: `https://honcdata.tmwcloud.com/jdata/executables/run/` (incorrect trailing slash)

This caused 404 errors from the API because the endpoint `/jdata/executables/run/` does not exist - only `/jdata/executables/run` does.

## Root Cause

The URL construction code always concatenated the base URL and subpath with a `/` separator, even when the subpath was empty:

```typescript
let url = `${baseUrl}/${subPath.replace(/^\//, '').replace(/\/$/, '')}`;
```

When `subPath` is empty, this becomes `baseUrl/` instead of just `baseUrl`.

## Solution

Modified the URL construction to only add the `/` separator when there is actually a subpath to append:

```typescript
const normalizedSubPath = subPath.replace(/^\//, '').replace(/\/$/, '');
let url = normalizedSubPath ? `${baseUrl}/${normalizedSubPath}` : baseUrl;
```

## Files Changed

1. `src/pages/DashboardViewer/DashboardCell.tsx` - Line 1303-1304
2. `src/hooks/useQueries.ts` - Lines 172-173 and 237-238
