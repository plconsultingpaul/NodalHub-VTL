# Team Member Invite Flow Fix

**Date:** 2026-06-10

## Problems

1. **Invited user not shown in Team Members list** - After inviting a new user, the `invite-user` edge function created the membership row (via the `handle_new_user` DB trigger) but did not update it with `invitation_sent_at` or `invitation_sent_count`. This meant the invite metadata was missing.

2. **Invited user not prompted to set a password** - The `inviteUserByEmail` call did not include a `redirectTo` URL, so Supabase used the default site URL. When the user clicked the invite link, they landed at the app root without being directed to the password-set page.

3. **No visual distinction between active and pending members** - The Team Members list showed all users as "Active" regardless of whether they had accepted the invite.

## Changes

### `supabase/functions/invite-user/index.ts`
- Added `redirectUrl` to the request interface, accepted from the frontend caller.
- After `inviteUserByEmail` succeeds, the function now updates the newly created membership row with `invitation_sent_at` and `invitation_sent_count: 1`.
- Passes `redirectTo` (pointing to `/reset-password`) to `inviteUserByEmail` so the invite email link sends the user to the password-set page.

### `src/pages/InviteCallback.tsx` (new file)
- A lightweight page that detects the invite session and redirects to `/reset-password`.

### `src/App.tsx`
- Added route `/invite-callback` pointing to the new `InviteCallback` component.

### `src/pages/ResetPassword.tsx`
- Added detection for `type=invite` in the URL hash so the password form shows immediately for invite callbacks.

### `src/pages/Settings/TeamMembers.tsx`
- Passes `redirectUrl: window.location.origin` in the invite request body.
- Shows "Pending Invite" (amber badge) for users who have `invitation_sent_at` set but `last_login_at` is null.
- Button text changes from "Send Invite" to "Resend Invite" when an invite has already been sent (`invitation_sent_count > 0`).

## How It Works Now

1. Admin clicks "Invite Member" and enters an email.
2. Frontend calls the `invite-user` edge function with the email, company, role, and `redirectUrl`.
3. Edge function creates the user via `inviteUserByEmail` with a redirect to `/reset-password`.
4. The DB trigger creates the profile and membership row; the edge function then updates the membership with invite tracking fields.
5. The invited user appears immediately in Team Members with a "Pending Invite" badge.
6. When the user clicks the email link, they land on `/reset-password` where they set their password.
7. After setting a password, they are redirected to the app dashboard.
