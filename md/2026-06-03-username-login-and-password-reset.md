# Auth: Username Login + Password Reset

Date: 2026-06-03

## Summary

Targeted changes to keep all users on Supabase Auth while adding two new
capabilities:

1. Login with **email or username** on the sign-in screen.
2. **Forgot / reset password** flow accessible from the login screen.

No custom auth tables were introduced. Supabase Auth remains the single
source of truth for credentials.

## Database

Migration: `add_username_to_profiles`

- Adds a nullable `username` column to `public.profiles`.
- Adds a partial unique index `profiles_username_lower_unique_idx` on
  `lower(username)` so usernames are case-insensitively unique. NULL values
  are excluded from the index, so existing accounts without a username do
  not collide.
- Existing data is unaffected.

## Edge Function

New function: `supabase/functions/username-to-email/index.ts`

- Public (no JWT verification) so it can be called from the login screen
  before a session exists.
- Accepts `POST { username }`, returns `{ email }` on success or 404 if
  the username is not found.
- Uses the service role client internally to read the profile, but only
  ever returns the email tied to that username. RLS on `profiles` remains
  strict for normal client traffic.

## Frontend

### `src/contexts/AuthContext.tsx`
- `signIn(emailOrUsername, password)` now detects whether the input
  contains `@`. If not, it calls the `username-to-email` edge function
  and then completes a normal `signInWithPassword`.
- `signUp(email, password, fullName, username?)` accepts an optional
  username and persists it to the user's profile after sign-up.
- New `resetPasswordForEmail(email)` wraps Supabase's recovery email
  with a redirect back to `/reset-password`.
- New `updatePassword(newPassword)` wraps `supabase.auth.updateUser`.

### `src/pages/Login.tsx`
- Email field replaced by a single "Email or username" field.
- Adds a "Forgot password?" link to `/forgot-password`.

### `src/pages/Register.tsx`
- Adds an optional username field with client-side validation
  (3-32 chars, letters/numbers/`._-`).

### `src/pages/ForgotPassword.tsx` (new)
- Collects an email and triggers the recovery email.
- Shows a confirmation state regardless of whether the email exists, to
  avoid leaking which addresses are registered.

### `src/pages/ResetPassword.tsx` (new)
- Listens for the `PASSWORD_RECOVERY` auth event (or an active session)
  before showing the form.
- Calls `updateUser({ password })` and redirects to the dashboard on
  success.

### `src/App.tsx`
- Adds `/forgot-password` (public) and `/reset-password` routes.
- `/reset-password` is intentionally not wrapped in `PublicRoute` because
  the recovery link puts the user into a temporary session; the page
  itself gates rendering on the recovery event.

### `src/types/database.ts`
- Adds `username` to the `profiles` table types.

## Notes / Follow-ups

- Supabase project email templates must include the `{{ .ConfirmationURL }}`
  for password recovery; this is the default and no change is required
  unless the template has been customized.
- The username lookup is intentionally **not** rate-limited at the app
  layer; rely on Supabase's built-in edge function rate limits. If abuse
  is observed, add a throttle inside the edge function.
