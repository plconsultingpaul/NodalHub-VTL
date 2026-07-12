# SSO Quick Switch - User Existence Check

**Date:** 2026-06-11

## Problem

When a user initiated a Quick Switch SSO login from Parse-It to this application (Nodal Hub), the `verify-sso-token` edge function would call `adminClient.auth.admin.generateLink({ type: "magiclink", email })` without first checking if the email corresponded to an existing user. Supabase's `generateLink` auto-creates a new auth user if one doesn't exist, which meant any valid SSO ticket holder could gain access even if they had no account in this application.

## Fix

Added a user existence check in `supabase/functions/verify-sso-token/index.ts` **before** calling `generateLink`:

1. Call `adminClient.auth.admin.listUsers()` to retrieve existing users
2. Check if any user's email matches the one from the SSO ticket (case-insensitive)
3. If no match is found, return a `404` error with message "User not registered in this application"
4. Only proceed with magic link generation if the user already exists

## Files Changed

- `supabase/functions/verify-sso-token/index.ts` - Added user lookup before `generateLink` call
- `src/pages/SsoCallback.tsx` - Switched from `supabase.functions.invoke` to direct `fetch` so error response bodies are properly parsed; added user-friendly "Account Not Found" messaging when the user doesn't exist

## Impact

- Users who don't have an account in this Supabase project will now see an "Account Not Found" screen with the message "Your account does not exist in this application. Please contact your administrator to get access." and a button to go to the login page
- No new ghost accounts will be auto-created via SSO
- Existing SSO flow for valid users remains unchanged
