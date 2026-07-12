# Quick Switch & SSO Applications - Integration Guide

## Overview

This document describes the complete Quick Switch SSO system used by Nodal Hub. It enables seamless one-click login between multiple Supabase-backed applications that share the same `SSO_SHARED_SECRET`. Use this guide to integrate your other application as either a **source** (initiating the switch) or a **target** (receiving the SSO ticket).

---

## Architecture

```
Source App (Nodal Hub)                    Target App (Your App)
========================                  =======================

User clicks "Quick Switch"
         |
         v
create-sso-token (edge fn)
  - Verifies user session
  - Signs JWT (email, iss, aud, 60s TTL)
  - Returns redirect URL
         |
         v
Browser opens new tab:
  https://your-app.com/auth/sso?ticket=<JWT>
                                              |
                                              v
                                    /auth/sso route (SsoCallback)
                                      - Reads ?ticket param
                                      - Calls verify-sso-token
                                              |
                                              v
                                    verify-sso-token (edge fn)
                                      - Verifies JWT signature
                                      - Checks aud == SSO_CURRENT_APP_ID
                                      - Checks user exists in auth.users
                                      - Generates magiclink token_hash
                                      - Returns { tokenHash }
                                              |
                                              v
                                    SsoCallback calls verifyOtp({
                                      token_hash, type: 'magiclink'
                                    })
                                              |
                                              v
                                    Session established, redirect to /
```

---

## Required Edge Function Secrets (per app)

Both applications must have these secrets configured in their Supabase Edge Function environment:

| Secret | Description | Example |
|--------|-------------|---------|
| `SSO_SHARED_SECRET` | Symmetric HMAC key for signing/verifying JWT tickets. **Must be identical** across all participating apps. Minimum 32 characters recommended. | `my-super-secret-shared-key-32chars+` |
| `SSO_CURRENT_APP_ID` | A unique string identifying THIS application. Used as `iss` when creating tokens and matched against `aud` when receiving tokens. | `nodal-hub`, `nodal-crm`, `analytics` |

---

## Database Table: `sso_applications`

This table lives in each app's Supabase project and stores the list of other apps available for Quick Switch.

```sql
CREATE TABLE sso_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  app_identifier text NOT NULL,
  icon_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sso_applications ENABLE ROW LEVEL SECURITY;
```

### Column Definitions

| Column | Type | Description |
|--------|------|-------------|
| `company_id` | uuid | The company this app config belongs to |
| `name` | text | Display name shown in the Quick Switch menu (e.g., "Nodal CRM") |
| `url` | text | Base URL of the target application (e.g., `https://crm.example.com`). The `/auth/sso` path is appended automatically. |
| `app_identifier` | text | The target app's `SSO_CURRENT_APP_ID` value. Used as the `aud` claim in the JWT. |
| `icon_url` | text (nullable) | Optional icon/logo URL to display next to the app name |
| `sort_order` | integer | Display order in the Quick Switch menu |

### RLS Policies

- **SELECT**: Any authenticated company member
- **INSERT/UPDATE/DELETE**: Admin role only

---

## Edge Function: `create-sso-token` (Source Side)

This function runs on the **source** app when a user wants to switch to another app.

### Endpoint

```
POST /functions/v1/create-sso-token
```

### Headers

```
Authorization: Bearer <user's_access_token>
Content-Type: application/json
apikey: <supabase_anon_key>
```

### Request Body

```json
{
  "targetUrl": "https://target-app.example.com",
  "appIdentifier": "target-app-id"
}
```

### Response (200)

```json
{
  "redirectUrl": "https://target-app.example.com/auth/sso?ticket=eyJhbGciOiJIUzI1NiJ9..."
}
```

### JWT Payload Signed

```json
{
  "email": "user@example.com",
  "iss": "<SSO_CURRENT_APP_ID of source app>",
  "aud": "<appIdentifier from request>",
  "exp": "<now + 60 seconds>",
  "iat": "<now>"
}
```

### Full Implementation

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ssoSecret = Deno.env.get("SSO_SHARED_SECRET");

    if (!ssoSecret) {
      return new Response(
        JSON.stringify({ error: "SSO_SHARED_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the calling user is authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { targetUrl, appIdentifier } = await req.json();
    if (!targetUrl || !appIdentifier) {
      return new Response(
        JSON.stringify({ error: "Missing targetUrl or appIdentifier" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sign the SSO ticket
    const secret = new TextEncoder().encode(ssoSecret);
    const currentAppId = Deno.env.get("SSO_CURRENT_APP_ID") || "unknown";

    const token = await new SignJWT({
      email: user.email,
      iss: currentAppId,
      aud: appIdentifier,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("60s")
      .setIssuedAt()
      .sign(secret);

    const redirectUrl = `${targetUrl.replace(/\/$/, "")}/auth/sso?ticket=${token}`;

    return new Response(
      JSON.stringify({ redirectUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

**Deploy settings**: `verify_jwt: true` (user must be authenticated to create a token)

---

## Edge Function: `verify-sso-token` (Target Side)

This function runs on the **target** app when it receives an incoming SSO ticket.

### Endpoint

```
POST /functions/v1/verify-sso-token
```

### Headers

```
Content-Type: application/json
Authorization: Bearer <supabase_anon_key>
apikey: <supabase_anon_key>
```

Note: This endpoint does NOT verify JWT auth (the user is unauthenticated at this point -- that's the whole purpose of SSO).

### Request Body

```json
{
  "ticket": "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLC..."
}
```

### Response (200)

```json
{
  "tokenHash": "pkce_abc123..."
}
```

### Error Responses

| Status | Error | Meaning |
|--------|-------|---------|
| 400 | `"Missing ticket"` | No ticket in request body |
| 401 | `"Invalid or expired ticket"` | JWT signature invalid, audience mismatch, or expired (>60s) |
| 404 | `"User not registered in this application"` | The email from the JWT does not have an account in this Supabase project |
| 500 | `"SSO_SHARED_SECRET not configured"` | Missing environment variable |

### Full Implementation

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jwtVerify } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ssoSecret = Deno.env.get("SSO_SHARED_SECRET");
    const currentAppId = Deno.env.get("SSO_CURRENT_APP_ID") || "unknown";

    if (!ssoSecret) {
      return new Response(
        JSON.stringify({ error: "SSO_SHARED_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { ticket } = await req.json();
    if (!ticket) {
      return new Response(
        JSON.stringify({ error: "Missing ticket" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify JWT signature and audience
    const secret = new TextEncoder().encode(ssoSecret);
    let payload;
    try {
      const result = await jwtVerify(ticket, secret, {
        audience: currentAppId,
      });
      payload = result.payload;
    } catch (jwtError) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired ticket" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = payload.email as string;
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Invalid ticket payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists in this application
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      return new Response(
        JSON.stringify({ error: "Failed to verify user existence" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!existingUser) {
      return new Response(
        JSON.stringify({ error: "User not registered in this application" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate magic link for the verified user
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError) {
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) {
      return new Response(
        JSON.stringify({ error: "Failed to extract token hash" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ tokenHash }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

**Deploy settings**: `verify_jwt: false` (incoming users are unauthenticated)

---

## Frontend: `/auth/sso` Route (Target Side)

Your app needs a route at `/auth/sso` that handles the incoming ticket. Here is the complete React component:

```tsx
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function SsoCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ticket = searchParams.get('ticket');

    if (!ticket) {
      setError('No SSO ticket provided');
      return;
    }

    async function verifyTicket(ticket: string) {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        // Call verify-sso-token directly via fetch (not supabase.functions.invoke)
        // so we can properly read the error response body on non-2xx responses
        const response = await fetch(`${supabaseUrl}/functions/v1/verify-sso-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ ticket }),
        });

        const data = await response.json();

        if (!response.ok || !data?.tokenHash) {
          setError(data?.error || 'SSO verification failed');
          return;
        }

        // Exchange the token hash for a session
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: 'magiclink',
        });

        if (otpError) {
          setError(otpError.message);
          return;
        }

        navigate('/', { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'SSO verification failed');
      }
    }

    verifyTicket(ticket);
  }, [searchParams]);

  if (error) {
    const isUserNotFound = error.toLowerCase().includes('not registered');
    const title = isUserNotFound ? 'Account Not Found' : 'SSO Login Failed';
    const message = isUserNotFound
      ? 'Your account does not exist in this application. Please contact your administrator to get access.'
      : error;

    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={() => navigate('/login')}>Go to Login</button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <p>Logging you in...</p>
    </div>
  );
}
```

### Route Registration (React Router)

```tsx
import SsoCallback from './pages/SsoCallback';

// In your router config:
<Route path="/auth/sso" element={<SsoCallback />} />
```

---

## Frontend: Quick Switch Menu (Source Side)

To add Quick Switch to your other app, render the applications from the `sso_applications` table and call `create-sso-token` on click:

```tsx
import { supabase } from '../lib/supabase';

// Fetch apps for the active company
const { data: applications } = await supabase
  .from('sso_applications')
  .select('*')
  .eq('company_id', activeCompanyId)
  .order('sort_order', { ascending: true });

// On click handler for a Quick Switch item:
function handleQuickSwitch(app: { url: string; app_identifier: string }) {
  const newTab = window.open('about:blank', '_blank');

  supabase.functions.invoke('create-sso-token', {
    body: { targetUrl: app.url, appIdentifier: app.app_identifier },
  }).then(({ data, error }) => {
    if (!error && data?.redirectUrl && newTab) {
      newTab.location.href = data.redirectUrl;
    } else if (newTab) {
      newTab.close();
    }
  });
}
```

**Why `window.open('about:blank')` first?** Browsers block `window.open` calls that aren't in the synchronous click handler. By opening a blank tab immediately, then setting its URL after the async call completes, we avoid popup blockers.

---

## Step-by-Step Setup for Your Other Application

### 1. Set Edge Function Secrets

Set these secrets on your Supabase project (via dashboard or MCP tools):

```
SSO_SHARED_SECRET = <same value as Nodal Hub>
SSO_CURRENT_APP_ID = <your-app-identifier>  (e.g., "nodal-crm")
```

### 2. Deploy `verify-sso-token` Edge Function

Copy the `verify-sso-token` implementation above into `supabase/functions/verify-sso-token/index.ts` and deploy with `verify_jwt: false`.

### 3. Deploy `create-sso-token` Edge Function

Copy the `create-sso-token` implementation above into `supabase/functions/create-sso-token/index.ts` and deploy with `verify_jwt: true`.

### 4. Add the `/auth/sso` Route

Add the `SsoCallback` component to your router at `/auth/sso`.

### 5. Create the `sso_applications` Table

Run the migration SQL from the "Database Table" section above. Adapt the `company_id` reference if your schema differs.

### 6. Configure Applications in Both Apps

**In Nodal Hub** (Settings > Applications):
- Name: `Your App Name`
- URL: `https://your-app.example.com`
- App Identifier: `<SSO_CURRENT_APP_ID of your app>`

**In Your App** (Settings > Applications or direct DB insert):
- Name: `Nodal Hub`
- URL: `https://nodal-hub.example.com`
- App Identifier: `nodal-hub` (the `SSO_CURRENT_APP_ID` of Nodal Hub)

### 7. Ensure Users Exist in Both Apps

The SSO flow does NOT auto-create users. A user must have an account (in `auth.users`) in **both** the source and target applications. If a user doesn't exist in the target app, they'll see an "Account Not Found" error.

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Token replay | 60-second expiry; single-use magic link |
| Cross-app replay | `aud` claim ensures a token for app A cannot be used at app B |
| Secret exposure | `SSO_SHARED_SECRET` never leaves edge functions (server-side only) |
| User enumeration | `verify-sso-token` only accepts requests with a valid signed JWT |
| Unauthorized app registration | Only Admin-role users can add/edit/delete applications in Settings |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Invalid or expired ticket" | Secrets don't match OR token >60s old | Verify `SSO_SHARED_SECRET` is identical in both projects; check system clocks |
| "Invalid or expired ticket" with audience mismatch | `SSO_CURRENT_APP_ID` on target doesn't match `appIdentifier` sent by source | Ensure the `app_identifier` in `sso_applications` matches exactly the target's `SSO_CURRENT_APP_ID` |
| "User not registered in this application" | Email from JWT doesn't exist in target's `auth.users` | Create the user account in the target app first |
| "SSO_SHARED_SECRET not configured" | Secret not set in edge function environment | Add the secret via Supabase dashboard > Edge Functions > Secrets |
| Popup blocked | Browser blocked `window.open` | Make sure `window.open('about:blank', '_blank')` is called synchronously in the click handler |
| "Edge Function returned a non-2xx status code" | Using `supabase.functions.invoke` which swallows error body | Use direct `fetch()` instead (see SsoCallback implementation) |

---

## NPM Dependencies for Edge Functions

Both edge functions use these npm imports (available via Deno's npm specifier):

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT } from "npm:jose@5";       // create-sso-token
import { jwtVerify } from "npm:jose@5";     // verify-sso-token
```

No `package.json` or `node_modules` needed -- Deno resolves these at deploy time.
