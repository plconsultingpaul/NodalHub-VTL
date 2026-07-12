# Query Manager - Test Query Flow & Authentication

## Overview

This document details exactly what happens when you click the Play button to test a query in the Query Manager. It explains the full request chain, how authentication headers are assembled, and how the request reaches the target API.

---

## Architecture Summary

```
Browser (Query Manager)
    |
    | POST to Supabase Edge Function
    v
api-proxy Edge Function (supabase/functions/api-proxy/index.ts)
    |
    | Forwards request to actual target API
    v
Target API (e.g., nodal.prioritylogisticsinc.com:8083)
```

The browser does NOT call the target API directly. All requests go through the `api-proxy` edge function which acts as a CORS-free forwarding proxy.

---

## Step-by-Step Flow

### 1. User Clicks Play Button

File: `src/pages/QueryManager/index.tsx`

The `handleTestQuery(query)` function is called. It checks if the query has `user_parameters`. If it does, a parameter prompt modal is shown first. If not, it calls `runTest(query, {})` immediately.

### 2. `runTest()` Assembles the Request

File: `src/pages/QueryManager/index.tsx` (line ~236)

#### 2a. Build the URL

```
endpoint.url + substitutedSubPath + queryParameters
```

- **Base URL**: Comes from `query.api_endpoints.url` (the API Endpoint record in the database)
- **Sub-path**: `query.api_sub_path` with `{paramName}` placeholders replaced by user parameter values
- **Query parameters**: Either structured `query.query_parameters` array or raw `query.url_query_string`

Example result: `https://nodal.prioritylogisticsinc.com:8083/jdata/executables/run`

#### 2b. Build Headers (INCLUDING AUTH)

```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(endpoint.headers as Record<string, string> || {})
};
```

Then authentication is added based on `endpoint.auth_type`:

| auth_type | What gets added | Source |
|-----------|-----------------|--------|
| `bearer` | `Authorization: Bearer <token>` | `endpoint.auth_config.token` |
| `api_key` | `<header_name>: <api_key>` | `endpoint.auth_config.header_name` + `endpoint.auth_config.api_key` |
| `basic` | `Authorization: Basic <base64(user:pass)>` | `endpoint.auth_config.username` + `endpoint.auth_config.password` |
| `none` | Nothing added | - |

**CRITICAL**: The auth credentials (token, API key, username/password) are stored in the `api_endpoints.auth_config` JSONB column in the database. They are fetched from Supabase and used client-side to build the headers object.

#### 2c. Build Request Body (for POST/PUT/PATCH)

Two options:
1. **Template-based**: If `query.request_body_template` exists, it parses it as JSON and applies `request_body_field_mappings` to substitute user parameter values into specific fields
2. **Static JSON**: Falls back to `query.json_parameters` if no template

Example body for the Dispatch Sheet query:
```json
{
  "name": "dispatchSheet",
  "inputs": {
    "TERMINAL": "TERM-ON"
  }
}
```

### 3. `proxyFetch()` Sends to Edge Function

File: `src/lib/apiProxy.ts`

The assembled request is NOT sent directly to the target API. Instead, it's wrapped and sent to the `api-proxy` edge function:

```typescript
POST ${SUPABASE_URL}/functions/v1/api-proxy
Headers:
  Content-Type: application/json
  Authorization: Bearer ${SUPABASE_ANON_KEY}   <-- This authenticates with Supabase only

Body (JSON):
{
  "targetUrl": "https://nodal.prioritylogisticsinc.com:8083/jdata/executables/run",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer <the-actual-api-token-from-endpoint-config>"
  },
  "body": {
    "name": "dispatchSheet",
    "inputs": { "TERMINAL": "TERM-ON" }
  }
}
```

**KEY DISTINCTION**: There are TWO Authorization headers in play:
1. `Authorization: Bearer ${SUPABASE_ANON_KEY}` - authenticates the request to the Supabase edge function itself
2. The `headers.Authorization` inside the JSON body - this is the **target API's auth token** that will be forwarded

### 4. Edge Function Forwards the Request

File: `supabase/functions/api-proxy/index.ts`

The edge function:
1. Parses the incoming JSON body to extract `targetUrl`, `method`, `headers`, and `body`
2. Makes a `fetch()` call to `targetUrl` with the provided `method`, `headers`, and `body`
3. Returns the response back to the browser

```typescript
const fetchOptions: RequestInit = {
  method: method || "GET",
  headers: requestHeaders,  // <-- These are the TARGET API headers (including its auth)
};

if (body && ["POST", "PUT", "PATCH"].includes(method)) {
  fetchOptions.body = JSON.stringify(body);
}

const response = await fetch(targetUrl, fetchOptions);
```

### 5. Response Returns to Browser

The edge function returns:
- On success (2xx): The parsed JSON response data
- On failure (non-2xx): `{ error: "API request failed: <status>", details: "<response body>" }`

The Query Manager displays the status code and response body in the test results modal.

---

## Authentication Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Database: api_endpoints table                                     │
│                                                                   │
│  id: uuid                                                         │
│  url: "https://nodal.prioritylogisticsinc.com:8083"              │
│  auth_type: "bearer"                                              │
│  auth_config: { "token": "eyJhbGciOiJSUz..." }  <-- THE JWT     │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                │ Fetched via Supabase client
                                │ (SELECT * FROM api_endpoints WHERE company_id = ...)
                                v
┌───────────────────────────────────────────────────────────────────┐
│ Browser: QueryManager/index.tsx                                    │
│                                                                    │
│  headers['Authorization'] = `Bearer ${authConfig.token}`           │
│  ─── builds full request object ───                                │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                │ POST to /functions/v1/api-proxy
                                │ Auth: Bearer SUPABASE_ANON_KEY (for edge fn access)
                                │ Body: { targetUrl, method, headers: {...auth...}, body }
                                v
┌───────────────────────────────────────────────────────────────────┐
│ Edge Function: api-proxy                                           │
│                                                                    │
│  Extracts headers from request body                                │
│  Makes fetch(targetUrl, { headers: { Authorization: Bearer JWT }}) │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                │ The actual API call with the real JWT
                                v
┌───────────────────────────────────────────────────────────────────┐
│ Target API: nodal.prioritylogisticsinc.com:8083                    │
│                                                                    │
│  Validates the JWT in the Authorization header                     │
│  Returns data or 401 if token is invalid/expired                   │
└────────────────────────────────────────────────────────────────────┘
```

---

## Where the 401 "UNAUTHORIZED_LEGACY_JWT" Error Comes From

Based on the error:
```json
{
  "code": "UNAUTHORIZED_LEGACY_JWT",
  "message": "Invalid JWT"
}
```

This is NOT a Supabase error. This is the **target API** (JData/priority logistics) rejecting the JWT token. The token stored in `api_endpoints.auth_config.token` for that endpoint is either:

1. **Expired** - The JWT has a limited lifetime and has expired
2. **Rotated** - The target API rotated its signing keys and the stored token uses an old key
3. **Different environment** - The newer Nodal Hub instance has a different (outdated/wrong) token stored in its `api_endpoints` table
4. **Legacy format** - The error code "UNAUTHORIZED_LEGACY_JWT" suggests the token format is outdated and the API no longer accepts that format

### Likely Root Cause

Both Nodal Hub instances (working and broken) are sending requests to the same target API (`nodal.prioritylogisticsinc.com:8083`). The difference is the JWT token stored in each instance's `api_endpoints.auth_config` column:

- **Working instance**: Has a valid, current JWT stored
- **Broken instance**: Has an expired or legacy-format JWT stored

### How to Verify

Run this SQL on both Supabase projects to compare the stored tokens:

```sql
SELECT name, url, auth_type, auth_config
FROM api_endpoints
WHERE url LIKE '%prioritylogisticsinc%';
```

Compare the `auth_config.token` values. If they differ, update the broken instance with the working token.

### Fix Options

1. **Update the token**: Copy the valid token from the working instance's `api_endpoints.auth_config` to the broken instance
2. **Generate a new token**: If the target API has a token refresh/regeneration mechanism, generate a fresh one and update the endpoint config in Settings > API Endpoints
3. **Check token format**: If "LEGACY_JWT" means the API upgraded its auth system, you may need to obtain a token in the new format from the target API provider

---

## Key Files Reference

| File | Role |
|------|------|
| `src/pages/QueryManager/index.tsx` | Assembles URL, headers (with auth), and body; calls `proxyFetch()` |
| `src/lib/apiProxy.ts` | Wraps the request and sends it to the edge function |
| `supabase/functions/api-proxy/index.ts` | Receives the wrapped request and forwards it to the target API |
| `src/hooks/useEndpoints.ts` | Fetches endpoint configs (including auth) from Supabase |
| `src/pages/Settings/ApiEndpoints.tsx` | UI for configuring endpoints and their auth credentials |

---

## Database Schema (Relevant Columns)

### `api_endpoints` table

| Column | Type | Description |
|--------|------|-------------|
| `url` | text | Base URL of the API |
| `auth_type` | text | One of: `none`, `bearer`, `api_key`, `basic` |
| `auth_config` | jsonb | Auth credentials (varies by type) |
| `headers` | jsonb | Additional custom headers to send |

### `auth_config` shape by auth_type

```typescript
// bearer
{ "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." }

// api_key
{ "header_name": "X-API-Key", "api_key": "abc123..." }

// basic
{ "username": "user", "password": "pass" }
```
