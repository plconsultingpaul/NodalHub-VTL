# Supabase Edge Function API Proxy Guide

## Problem: CORS Restrictions

When a browser-based application tries to call an external API directly, it often fails due to CORS (Cross-Origin Resource Sharing) restrictions. The external API server must explicitly allow requests from your domain, which is often not the case.

```
Browser -> External API = BLOCKED by CORS
```

## Solution: Server-Side Proxy

A Supabase Edge Function acts as a proxy between your app and the external API. Since Edge Functions run server-side, they are not subject to CORS restrictions.

```
Browser -> Edge Function (allowed) -> External API (server-side, no CORS) -> Edge Function -> Browser
```

## Architecture

```
+-------------------+         +----------------------+         +------------------+
|                   |         |                      |         |                  |
|   Your App        |  --->   |   Supabase Edge      |  --->   |   External API   |
|   (Browser)       |         |   Function (Proxy)   |         |   (Target)       |
|                   |  <---   |                      |  <---   |                  |
+-------------------+         +----------------------+         +------------------+
     CORS allowed                  No CORS issues                Server-to-server
```

## Implementation

### 1. Edge Function Structure

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// CORS headers - required for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. Parse request from your app
    const { targetUrl, method, headers, body } = await req.json();

    // 2. Make server-side request to external API (no CORS)
    const response = await fetch(targetUrl, {
      method: method || "GET",
      headers: headers || {},
      body: body ? JSON.stringify(body) : undefined,
    });

    // 3. Get response data
    const data = await response.json();

    // 4. Return to your app with CORS headers
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 2. Calling the Edge Function from Your App

```typescript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

async function callExternalApi(targetUrl: string, method = 'GET', body?: any) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/your-proxy-function`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      targetUrl,
      method,
      body,
    }),
  });

  if (!response.ok) {
    throw new Error(`Proxy request failed: ${response.status}`);
  }

  return response.json();
}

// Usage
const data = await callExternalApi('https://api.example.com/endpoint');
```

## Complete Production Example

Below is a full-featured proxy implementation with authentication support:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      targetUrl,
      method = "GET",
      headers: customHeaders = {},
      body,
      authToken,
      responseType = "json"  // "json" or "blob"
    } = await req.json();

    // Validate required fields
    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: "targetUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build request headers
    const requestHeaders: Record<string, string> = {
      ...customHeaders,
    };

    // Add auth if provided
    if (authToken) {
      requestHeaders["Authorization"] = `Bearer ${authToken}`;
    }

    // Set content type for requests with body
    if (body && !requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "application/json";
    }

    console.log(`[proxy] ${method} ${targetUrl}`);

    // Make the request to external API
    const response = await fetch(targetUrl, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[proxy] Error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({
          error: `API request failed: ${response.status} ${response.statusText}`,
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle blob responses (for file downloads)
    if (responseType === "blob") {
      const blobData = await response.arrayBuffer();
      const contentType = response.headers.get("Content-Type") || "application/octet-stream";
      const contentDisposition = response.headers.get("Content-Disposition") || "";

      return new Response(blobData, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": contentDisposition,
        }
      });
    }

    // Handle JSON responses
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { rawResponse: responseText };
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[proxy] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

## Key Points

### CORS Headers Are Required
The Edge Function must return CORS headers so the browser accepts the response:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
```

### Handle OPTIONS Preflight
Browsers send an OPTIONS request before the actual request. Always handle it:
```typescript
if (req.method === "OPTIONS") {
  return new Response(null, { status: 200, headers: corsHeaders });
}
```

### Include CORS Headers in ALL Responses
Every response must include CORS headers, including error responses:
```typescript
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, "Content-Type": "application/json" }
});
```

### Error Handling
Always wrap the main logic in try-catch and return proper error responses:
```typescript
try {
  // ... main logic
} catch (err) {
  return new Response(
    JSON.stringify({ error: err.message }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

## Deployment

### Using Supabase Dashboard
1. Go to your Supabase project
2. Navigate to Edge Functions
3. Create a new function
4. Paste your code
5. Deploy

### Using Supabase CLI
```bash
supabase functions deploy your-proxy-function
```

## Security Considerations

1. **Rate Limiting**: Consider adding rate limiting to prevent abuse
2. **URL Validation**: Validate targetUrl to prevent SSRF attacks
3. **Authentication**: Require authentication for sensitive endpoints
4. **Logging**: Log requests for debugging but avoid logging sensitive data

## Example: URL Validation

```typescript
const ALLOWED_DOMAINS = [
  'api.example.com',
  'api.another-service.com',
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

// In your handler:
if (!isAllowedUrl(targetUrl)) {
  return new Response(
    JSON.stringify({ error: "Target URL not allowed" }),
    { status: 403, headers: corsHeaders }
  );
}
```

## Summary

| Step | Action |
|------|--------|
| 1 | App sends request to Edge Function with API details |
| 2 | Edge Function validates the request |
| 3 | Edge Function makes server-side call to external API |
| 4 | External API responds to Edge Function |
| 5 | Edge Function returns response to app with CORS headers |

This pattern completely bypasses CORS restrictions because the actual external API call happens server-side, where CORS does not apply.
