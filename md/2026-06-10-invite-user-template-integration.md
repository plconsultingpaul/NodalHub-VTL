# 2026-06-10 Invite User Flow Fix + Email Template Integration

## Summary

Fixed two issues with the user invitation flow:
1. Newly invited users were not appearing in the Team Members list
2. Invitation emails were using Supabase's built-in default email instead of the custom Email Templates

## Root Causes

### Users Not Appearing
The old `invite-user` edge function used `inviteUserByEmail()` which creates the auth user but relied on a database trigger to create the `company_memberships` record. This trigger only fires when the user confirms their signup (clicks the link), so the user was invisible until then.

### Email Templates Not Used
The old function delegated entirely to Supabase Auth's `inviteUserByEmail()` which sends its own system email template. The custom `invitation_email_templates` table was never queried or referenced.

## Fix (invite-user edge function rewrite)

### Change 1: Use `generateLink` instead of `inviteUserByEmail`
- `generateLink({ type: "invite" })` creates the auth user and returns the invitation link WITHOUT sending any email
- This gives us control over the email sending

### Change 2: Create membership immediately
- After generating the link, the function now directly inserts a `company_memberships` record
- The user appears in Team Members immediately (no waiting for confirmation)
- Handles the case where the trigger may have already created the membership (checks first, inserts or updates)

### Change 3: Send email via configured provider using templates
- Fetches the company's `email_configurations` (default email provider)
- Fetches the `admin_invitation` template from `invitation_email_templates`
- Replaces template variables: `{{name}}`, `{{username}}`, `{{reset_link}}`, `{{company_name}}`, `{{expiration_hours}}`
- Sends the rendered HTML email via Gmail API or Office 365 Graph API
- If no email provider is configured, the invite is still created (user appears in list) but no email is sent

### Change 4: Resend flow also uses templates
- The resend path now also uses `generateLink` + custom template sending
- Consistent behavior whether sending initial invite or resending

## Additional Fixes (same session)

### RLS: `is_company_admin` case sensitivity bug
The two-parameter `is_company_admin(uuid, uuid)` function checked `role = 'admin'` (lowercase) but the database stores `'Admin'` (capitalized). This caused the "Admins can read company memberships" policy to never match -- admins could only see their own row in the Team Members grid.

**Fix:** Replaced the function to use `role = 'Admin'`.

### RLS: Admins could not read other users' profiles
The `profiles` table only had a "Users can read own profile" SELECT policy. When querying `company_memberships` joined with `profiles`, the profile data for other users came back as null.

**Fix:** Added "Admins can read company member profiles" policy allowing admins to read profiles of users who share a company with them.

### Profile upsert on invite
Changed from conditional `.update()` (which could miss if the trigger hadn't fired yet) to `.upsert()` with `onConflict: "id"`. Also passes `full_name` in the `generateLink` metadata so the trigger populates the Display Name in Supabase Auth.

## Files Changed

- `supabase/functions/invite-user/index.ts` - Complete rewrite with template integration, profile upsert, full_name in metadata
- Migration: `fix_is_company_admin_case_sensitivity` - Fixed role case in is_company_admin function
- Migration: `allow_admins_read_company_member_profiles` - Added profiles SELECT policy for admins
