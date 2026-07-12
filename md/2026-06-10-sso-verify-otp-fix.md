# SSO Quick Switch - verifyOtp Fix

**Date:** 2026-06-10

## Problem

The SSO Quick Switch flow was not properly authenticating users on the target application. The original flow:

1. `verify-sso-token` returned a raw `actionLink` (a Supabase magic link URL like `https://<project>.supabase.co/auth/v1/verify?token=...`)
2. `SsoCallback` did `window.location.href = data.actionLink` which navigated to Supabase's auth server
3. Supabase would process the token and redirect back to the app's Site URL with tokens in the URL hash
4. This redirect-based approach failed because it depended on the Supabase Site URL being configured to the correct deployed URL, and the session tokens in the URL hash were not reliably picked up by the SPA

## Fix

Changed to a client-side OTP verification approach that eliminates the server redirect:

### `supabase/functions/verify-sso-token/index.ts`

- Still generates the magic link server-side via `adminClient.auth.admin.generateLink()`
- Now parses the `action_link` URL to extract the `token` (token_hash) query parameter
- Returns `{ tokenHash }` instead of `{ actionLink }`

### `src/pages/SsoCallback.tsx`

- Now expects `data.tokenHash` from the edge function (was `data.actionLink`)
- Calls `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` to establish the session directly in the browser
- On success, navigates to `/` using React Router (no full page reload needed)

## Why This Is Better

- No full-page redirect to Supabase's auth server and back
- Does not depend on the Supabase project's Site URL configuration
- Session is established directly in the browser where the Supabase client lives
- `onAuthStateChange` fires immediately with `SIGNED_IN`, loading profile/companies
- Works reliably across different deployment environments

## Files Changed

- `supabase/functions/verify-sso-token/index.ts` - Extract token_hash from generated link, return it instead of actionLink
- `src/pages/SsoCallback.tsx` - Use `verifyOtp` instead of `window.location.href` redirect
