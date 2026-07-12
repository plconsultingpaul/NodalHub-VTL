# 2026-06-10: Cross-Domain SSO with Applications Settings Page

## Summary

Implemented a decentralized cross-domain SSO system with a Settings > Applications page where admins configure target applications. Application links appear in the user menu (CompanySwitcher dropdown) under a "Quick Switch" section, enabling seamless one-click login to other Supabase apps.

## Changes Made

### Database

- **Migration: `create_sso_applications_table`** -- Creates `sso_applications` table with columns: `id`, `company_id`, `name`, `url`, `app_identifier`, `icon_url`, `sort_order`, `created_at`, `updated_at`. RLS policies restrict SELECT to company members and INSERT/UPDATE/DELETE to admins only.
- **Migration: `enable_realtime_sso_applications`** -- Adds the table to `supabase_realtime` publication so the CompanySwitcher can subscribe to live changes.

### New Files

1. **`src/hooks/useSsoApplications.ts`** -- Hook to fetch, create, update, and delete SSO application records for the active company.

2. **`src/pages/Settings/Applications.tsx`** -- Admin settings page with a table of configured applications, add/edit modal, and inline delete confirmation.

3. **`src/pages/SsoCallback.tsx`** -- Inbound SSO handler at `/auth/sso`. Reads the `ticket` query param, sends it to `verify-sso-token`, and redirects to the returned action link. Shows a "Logging you in..." spinner during handoff and an error state if verification fails.

4. **`supabase/functions/create-sso-token/index.ts`** (Outbound) -- Verifies the user's session, accepts `targetUrl` and `appIdentifier` from the request body (sourced from the DB on the frontend), signs a JWT with `SSO_SHARED_SECRET` (60s expiry, includes `iss` and `aud` claims), returns the redirect URL.

5. **`supabase/functions/verify-sso-token/index.ts`** (Inbound) -- Public endpoint (no JWT verification). Verifies the ticket JWT signature and `aud` claim, then uses `admin.generateLink({ type: 'magiclink', email })` to produce an authenticated action link.

### Modified Files

6. **`src/App.tsx`** -- Added imports for `Applications` and `SsoCallback`, added routes `/auth/sso` and `/settings/applications`.

7. **`src/pages/Settings/SettingsLayout.tsx`** -- Added `AppWindow` icon import and "Applications" tab (admin-only) to the settings navigation.

8. **`src/components/layout/CompanySwitcher.tsx`** -- Imported `useSsoApplications` and `supabase`. Added "Quick Switch" section to the dropdown showing configured applications. Clicking an app calls `create-sso-token` and opens the redirect URL in a new tab.

## Required Secrets

| Secret | Purpose |
|--------|---------|
| `SSO_SHARED_SECRET` | Symmetric key for signing/verifying JWT tickets (must be identical across all participating apps) |
| `SSO_CURRENT_APP_ID` | This app's identifier -- used as `iss` claim and matched against `aud` on the receiving side |

## How It Works

1. Admin goes to Settings > Applications and adds an app (e.g., "Nodal CRM", URL: `https://crm.example.com`, identifier: `crm`)
2. All company members see "Nodal CRM" under "Quick Switch" in their user menu
3. Clicking it invokes `create-sso-token` with `{ targetUrl, appIdentifier }` from the database record
4. Edge function signs a JWT (`email`, `iss`, `aud`, 60s expiry) and returns the redirect URL
5. Browser opens `https://crm.example.com/auth/sso?ticket=<JWT>` in a new tab
6. Target app's SsoCallback page sends the ticket to its own `verify-sso-token`
7. That function verifies signature + audience + expiry, then generates a magiclink
8. Frontend redirects to the action link, completing authentication

## Key Design Decisions

- **App URLs stored in database, not secrets** -- Admins can add/remove apps through the UI without needing access to edge function environment variables.
- **`SSO_SHARED_SECRET` remains a secret** -- The signing key must stay server-side and be shared across all apps out-of-band.
- **`aud` claim prevents cross-app replay** -- A ticket intended for "crm" cannot be used against "analytics" within the 60s window.
- **`verify-sso-token` deployed without JWT verification** -- Incoming users are unauthenticated (that's the point of SSO).
- **Opens in new tab** -- Preserves the user's current session/context in the source app.
