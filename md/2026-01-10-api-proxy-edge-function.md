# API Proxy Edge Function Implementation

**Date:** 2026-01-10

## Problem

External API calls made directly from the browser were failing due to CORS (Cross-Origin Resource Sharing) restrictions. When POST requests with JSON bodies are sent to external APIs, the browser performs a preflight OPTIONS request that the external API may not support, causing the request to fail.

## Solution

Implemented a Supabase Edge Function that acts as a server-side proxy for external API requests. Since the proxy runs server-side, it bypasses CORS restrictions entirely.

## Changes Made

### 1. New Edge Function: `api-proxy`

**File:** `supabase/functions/api-proxy/index.ts`

A new Supabase Edge Function that:
- Accepts POST requests with `targetUrl`, `method`, `headers`, and `body` parameters
- Makes the actual HTTP request server-side (no CORS)
- Returns the response with proper CORS headers for browser compatibility
- Handles errors gracefully

### 2. New Utility: `src/lib/apiProxy.ts`

A utility function `proxyFetch()` that provides a simple interface for routing requests through the proxy:
- Takes the same parameters as a standard fetch call
- Automatically routes the request through the Edge Function
- Returns a standard Response object for compatibility

### 3. Updated Files

Three files were updated to use the proxy instead of direct fetch calls:

#### `src/hooks/useQueries.ts`
- Added import for `proxyFetch`
- Modified `testQuery()` function to use `proxyFetch()` instead of `fetch()`

#### `src/pages/QueryManager/index.tsx`
- Added import for `proxyFetch`
- Modified `runTest()` function to use `proxyFetch()` instead of `fetch()`

#### `src/pages/DashboardViewer/DashboardCell.tsx`
- Added import for `proxyFetch`
- Modified `executeQuery()` function to use `proxyFetch()` instead of `fetch()`

## Architecture

```
Browser App                  Supabase Edge Function       External API
     |                              |                          |
     |-- POST /api-proxy ---------->|                          |
     |   (targetUrl, method,        |                          |
     |    headers, body)            |                          |
     |                              |-- HTTP Request --------->|
     |                              |   (server-side,          |
     |                              |    no CORS)              |
     |                              |                          |
     |                              |<-- Response -------------|
     |                              |                          |
     |<-- JSON Response ------------|                          |
     |   (with CORS headers)        |                          |
```

## Usage

The `proxyFetch()` function is a drop-in replacement for `fetch()`:

```typescript
import { proxyFetch } from '../lib/apiProxy';

const response = await proxyFetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token'
  },
  body: JSON.stringify({ data: 'value' })
});

const data = await response.json();
```

## Benefits

1. **Bypasses CORS** - All external API calls now work regardless of the target server's CORS configuration
2. **Minimal code changes** - The proxy utility maintains a similar interface to native fetch
3. **Centralized** - All external requests go through a single point, making it easier to add logging, rate limiting, or other features in the future
4. **Secure** - API keys and tokens are still sent to the external API, but the request originates from the server

---

## Additional Fix: Trailing Slash Normalization

**Date:** 2026-01-10

### Problem
The `api_sub_path` stored in the database sometimes includes a trailing slash (e.g., `jdata/executables/run/`). Some APIs (like the TMW API) return 404 errors for URLs with trailing slashes.

### Solution
Added `.replace(/\/$/, '')` to remove trailing slashes from the subpath when constructing URLs in all three files:
- `src/hooks/useQueries.ts`
- `src/pages/QueryManager/index.tsx`
- `src/pages/DashboardViewer/DashboardCell.tsx`

This ensures URLs are normalized regardless of how the path is stored in the database.
