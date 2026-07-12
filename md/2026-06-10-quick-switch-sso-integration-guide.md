# Quick Switch SSO Integration Guide

## Overview

This guide explains how to integrate your application with the Quick Switch SSO system. Quick Switch allows users to seamlessly switch between applications without re-entering credentials. When a user clicks an application in the "Quick Switch" section of the user menu, a short-lived JWT token is created, and the target application verifies it and signs the user in automatically.

Your application needs to support TWO roles:

1. **As a TARGET** -- Receiving incoming SSO tokens from other apps (users clicking your app's name in another application's Quick Switch menu)
2. **As a SOURCE** -- Sending SSO tokens to other apps (users clicking another app's name in YOUR Quick Switch menu)

Both roles share the same `SSO_SHARED_SECRET` environment variable. All applications in the ecosystem must use the same secret.

---

## Architecture

```
App A (Source)                                    App B (Target)
-----------                                       -----------
User clicks "App B"
  |
  v
create-sso-token edge function
  - Verifies user is authenticated
  - Creates JWT { email, iss: "AppA", aud: "AppB" }
  - Signs with SSO_SHARED_SECRET
  - Returns redirectUrl: https://appb.com/auth/sso?ticket=<JWT>
  |
  v
Browser opens new tab --> https://appb.com/auth/sso?ticket=<JWT>
                                                    |
                                                    v
                                          SsoCallback page extracts ticket
                                                    |
                                                    v
                                          verify-sso-token edge function
                                            - Verifies JWT signature with SSO_SHARED_SECRET
                                            - Validates audience matches SSO_CURRENT_APP_ID
                                            - Extracts email from payload
                                            - Generates magic link via Supabase Admin API
                                            - Returns actionLink
                                                    |
                                                    v
                                          Browser redirects to actionLink
                                            - Supabase processes magic link
                                            - User is now authenticated in App B
                                            - Redirects to app home page
```

---

## Required Environment Variables (Edge Function Secrets)

Set these as Supabase Edge Function secrets in your project:

| Secret | Description | Example |
|--------|-------------|---------|
| `SSO_SHARED_SECRET` | A shared secret string (min 32 chars) used to sign/verify JWT tokens. **Must be identical across ALL participating apps.** | `my-super-secret-shared-key-that-is-long-enough-123` |
| `SSO_CURRENT_APP_ID` | A unique identifier for THIS application. Used as the `iss` (issuer) when creating tokens and as the `aud` (audience) when verifying tokens. | `Parse-It` |

The `SSO_CURRENT_APP_ID` must match the `app_identifier` field configured in the Applications settings page of the SOURCE application. For example, if the source app has an entry with `app_identifier: "Parse-It"`, then Parse-It's `SSO_CURRENT_APP_ID` must be `Parse-It`.

---

## Step 1: Create the `verify-sso-token` Edge Function (TARGET role)

This function receives an incoming SSO ticket, verifies it, and generates a magic link to sign the user in.

**File: `supabase/functions/verify-sso-token/index.ts`**

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

    const secret = new TextEncoder().encode(ssoSecret);

    let payload;
    try {
      const result = await jwtVerify(ticket, secret, {
        audience: currentAppId,
      });
      payload = result.payload;
    } catch {
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

    // Use the admin client to generate a magic link for the user
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

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

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      return new Response(
        JSON.stringify({ error: "Failed to generate login link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ actionLink }),
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

**Important:** Deploy this function with `verify_jwt: false` since the SSO callback page calls it without an auth token (the user isn't logged in yet on the target app).

---

## Step 2: Create the `create-sso-token` Edge Function (SOURCE role)

This function creates a signed JWT for the currently authenticated user, addressed to a specific target app.

**File: `supabase/functions/create-sso-token/index.ts`**

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

    // Verify the calling user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const secret = new TextEncoder().encode(ssoSecret);
    const currentAppId = Deno.env.get("SSO_CURRENT_APP_ID") || "unknown";

    // Create a JWT token with:
    //   - email: the user's email
    //   - iss: this app's identifier (so target knows who sent it)
    //   - aud: the target app's identifier (so only the target accepts it)
    //   - exp: 60 seconds from now (short-lived for security)
    const token = await new SignJWT({
      email: user.email,
      iss: currentAppId,
      aud: appIdentifier,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("60s")
      .setIssuedAt()
      .sign(secret);

    // Build the redirect URL: target app's base URL + /auth/sso?ticket=<token>
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

**Deploy this function with `verify_jwt: true`** (default) since it requires an authenticated user.

---

## Step 3: Create the SSO Callback Page (TARGET role)

This is the frontend page at `/auth/sso` that receives the incoming SSO ticket, calls `verify-sso-token`, and redirects the user.

**File: `src/pages/SsoCallback.tsx` (or wherever your pages live)**

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
        const { data, error: fnError } = await supabase.functions.invoke('verify-sso-token', {
          body: { ticket },
        });

        if (fnError || !data?.actionLink) {
          setError(data?.error || fnError?.message || 'SSO verification failed');
          return;
        }

        // Redirect to the Supabase magic link which will sign the user in
        window.location.href = data.actionLink;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'SSO verification failed');
      }
    }

    verifyTicket(ticket);
  }, [searchParams]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h2>SSO Login Failed</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p>Logging you in...</p>
      </div>
    </div>
  );
}
```

**Register the route in your router:**

```tsx
<Route path="/auth/sso" element={<SsoCallback />} />
```

---

## Step 4: Create the `sso_applications` Table (SOURCE role)

This table stores the list of applications that appear in the Quick Switch menu.

**Migration SQL:**

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

-- All company members can see the apps in Quick Switch menu
CREATE POLICY "select_sso_applications" ON sso_applications FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = sso_applications.company_id
        AND company_memberships.user_id = auth.uid()
    )
  );

-- Only admins can manage applications
CREATE POLICY "insert_sso_applications" ON sso_applications FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = sso_applications.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "update_sso_applications" ON sso_applications FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = sso_applications.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = sso_applications.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

CREATE POLICY "delete_sso_applications" ON sso_applications FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = sso_applications.company_id
        AND company_memberships.user_id = auth.uid()
        AND company_memberships.role = 'Admin'
    )
  );

CREATE INDEX idx_sso_applications_company_id ON sso_applications(company_id);

-- Enable realtime so the Quick Switch menu updates when apps are added/removed
ALTER PUBLICATION supabase_realtime ADD TABLE sso_applications;
```

---

## Step 5: Create the `useSsoApplications` Hook (SOURCE role)

This hook fetches and manages SSO applications for the current company.

**File: `src/hooks/useSsoApplications.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface SsoApplication {
  id: string;
  company_id: string;
  name: string;
  url: string;
  app_identifier: string;
  icon_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SsoApplicationFormData {
  name: string;
  url: string;
  app_identifier: string;
  icon_url: string;
  sort_order: number;
}

export function useSsoApplications() {
  const { activeCompany } = useAuth();
  const [applications, setApplications] = useState<SsoApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!activeCompany?.id) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('sso_applications')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching SSO applications:', error);
    }

    setApplications(data || []);
    setLoading(false);
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    if (!activeCompany?.id) return;

    const handleRefresh = () => { fetchApplications(); };
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('sso-applications-changed', handleRefresh);

    const channel = supabase
      .channel(`sso_applications_${activeCompany.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sso_applications',
        filter: `company_id=eq.${activeCompany.id}`,
      }, () => {
        fetchApplications();
      })
      .subscribe();

    return () => {
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('sso-applications-changed', handleRefresh);
      supabase.removeChannel(channel);
    };
  }, [activeCompany?.id, fetchApplications]);

  const saveApplication = async (id: string | null, formData: SsoApplicationFormData) => {
    if (!activeCompany?.id) return { error: 'No active company' };

    const record = {
      company_id: activeCompany.id,
      name: formData.name,
      url: formData.url,
      app_identifier: formData.app_identifier,
      icon_url: formData.icon_url || null,
      sort_order: formData.sort_order,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await supabase
        .from('sso_applications')
        .update(record)
        .eq('id', id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from('sso_applications')
        .insert(record);
      if (error) return { error: error.message };
    }

    await fetchApplications();
    window.dispatchEvent(new Event('sso-applications-changed'));
    return { error: null };
  };

  const deleteApplication = async (id: string) => {
    const { error } = await supabase
      .from('sso_applications')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchApplications();
    window.dispatchEvent(new Event('sso-applications-changed'));
    return { error: null };
  };

  return { applications, loading, saveApplication, deleteApplication, refetch: fetchApplications };
}
```

---

## Step 6: Add Quick Switch to the User Menu (SOURCE role)

In your user menu/dropdown component, display the applications from the hook and invoke `create-sso-token` on click.

**Key pattern -- open the tab synchronously to avoid popup blockers:**

```tsx
import { useSsoApplications } from '../hooks/useSsoApplications';
import { supabase } from '../lib/supabase';

// Inside your user menu component:
const { applications } = useSsoApplications();

// Render the Quick Switch section:
{applications.length > 0 && (
  <>
    <Divider />
    <Label>Quick Switch</Label>
    {applications.map((app) => (
      <MenuItem
        key={app.id}
        onClick={() => {
          // IMPORTANT: Open the window synchronously (within the click event)
          // to prevent browser popup blockers
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
        }}
      >
        <ExternalLinkIcon />
        {app.name}
      </MenuItem>
    ))}
  </>
)}
```

---

## Step 7: Configure the Applications Page in Settings (SOURCE role)

Create a settings page where admins can add/edit/delete applications. The page should allow setting:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Display name shown in the Quick Switch menu | `Nodal 49` |
| **URL** | The base URL of the target application | `https://nodal49.app.com` |
| **App Identifier** | Must match the target app's `SSO_CURRENT_APP_ID` secret | `Nodal-49` |
| **Icon URL** (optional) | Small icon shown next to the name | `https://...` |
| **Sort Order** | Controls display order in the menu | `0` |

---

## Step 8: Supabase Auth Configuration

For the magic link flow to work correctly, ensure your Supabase project has the **Site URL** configured properly:

1. Go to your Supabase project > Authentication > URL Configuration
2. Set **Site URL** to your application's base URL (e.g., `https://dev1.parse-it.com`)
3. Under **Redirect URLs**, add your application's base URL

This ensures that after Supabase processes the magic link, it redirects the user back to your application.

---

## Bi-Directional Setup Example

Assuming two apps: **Nodal 49** (this app) and **Parse-It** (your app):

### On Parse-It's side:

1. Set edge function secrets:
   - `SSO_SHARED_SECRET` = (same value as Nodal 49)
   - `SSO_CURRENT_APP_ID` = `Parse-It`

2. Deploy `verify-sso-token` (so Nodal 49 users can SSO into Parse-It)
3. Deploy `create-sso-token` (so Parse-It users can SSO into Nodal 49)
4. Create the `/auth/sso` route with the SsoCallback page
5. In Parse-It's Applications settings, add:
   - Name: `Nodal 49`
   - URL: `https://your-nodal49-url.com` (the URL where Nodal 49 is deployed)
   - App Identifier: `Nodal-49` (must match Nodal 49's `SSO_CURRENT_APP_ID`)

### On Nodal 49's side (already done):

1. Edge function secrets already set:
   - `SSO_SHARED_SECRET` = (the shared value)
   - `SSO_CURRENT_APP_ID` = `Nodal-49`

2. Both edge functions already deployed
3. `/auth/sso` route already exists
4. In Applications settings, "Parse-It" is already configured:
   - Name: `Parse-It`
   - URL: `https://dev1.parse-it.com/`
   - App Identifier: `Parse-It`

---

## Security Considerations

1. **Short-lived tokens** -- JWT tokens expire after 60 seconds. This limits the attack window if a token is intercepted.

2. **Audience validation** -- The `aud` claim ensures a token meant for App A cannot be used to log into App B. Each app validates that the token's audience matches its own `SSO_CURRENT_APP_ID`.

3. **Shared secret** -- The `SSO_SHARED_SECRET` must be kept secure and identical across all participating apps. If compromised, rotate it simultaneously on all apps.

4. **Email-based matching** -- The SSO flow matches users by email. The user must exist in the target application's Supabase auth system. If the email doesn't exist, Supabase's `generateLink` will create the user (this is default behavior for magic links). If you want to restrict this, add a check in `verify-sso-token` to verify the user already exists before generating the link.

5. **No stored tokens** -- SSO tickets are not stored in any database. They are single-use (due to the 60s expiry and the magic link being consumed on redirect).

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "SSO_SHARED_SECRET not configured" | Secret not set in edge function environment | Add the secret via Supabase Dashboard > Edge Functions > Secrets |
| "Invalid or expired ticket" | Token older than 60s, or secrets don't match between apps | Ensure `SSO_SHARED_SECRET` is identical on both apps |
| "Invalid ticket payload" | The JWT was created without an email claim | Check the source app's `create-sso-token` function |
| Popup blocked | `window.open` called after async operation | Use the synchronous open pattern (open blank tab first, then navigate) |
| User not signed in after redirect | Site URL misconfigured in Supabase | Check Authentication > URL Configuration in Supabase Dashboard |
| "Failed to generate login link" | Email doesn't match any user | User must exist or magic link auto-creation must be enabled |

---

## Quick Checklist

- [ ] `SSO_SHARED_SECRET` set as edge function secret (same value as partner app)
- [ ] `SSO_CURRENT_APP_ID` set as edge function secret (unique to this app)
- [ ] `verify-sso-token` edge function deployed (with `verify_jwt: false`)
- [ ] `create-sso-token` edge function deployed (with `verify_jwt: true`)
- [ ] `/auth/sso` route exists with SsoCallback component
- [ ] `sso_applications` table created with RLS policies
- [ ] Applications settings page for admins to manage apps
- [ ] Quick Switch section added to user menu
- [ ] Supabase Site URL configured correctly
- [ ] Partner app's URL and identifier added to Applications settings
