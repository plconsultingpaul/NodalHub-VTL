# User Management Page Redesign

**Date:** 2026-06-10

## Summary

Redesigned the Team Members page to match the reference application's User Management layout. Replaced the card-based list with a proper data table and added inline action icons.

## Changes

### `src/pages/Settings/TeamMembers.tsx` (full rewrite)

**Layout:**
- Replaced card/list layout with a proper HTML table matching the reference app
- Columns: USERNAME, NAME, EMAIL, ROLE, STATUS, INVITATION, LAST LOGIN, ACTIONS
- Header renamed from "Team Members" to "User Management"
- Button renamed from "Invite Member" to "Add User"

**Columns:**
- **Username** - Shows profile username in italic, or `-` if not set
- **Name** - Full name or `-`
- **Email** - User email
- **Role** - Color-coded badge (blue for Admin, teal for Editor, gray for Viewer) with filled circle icon
- **Status** - Green "Active" or gray "Inactive" badge
- **Invitation** - Shows "Not sent" (italic) or "Sent Nx" with clock icon and date/time
- **Last Login** - Formatted as M/D/YYYY, H:MM:SS AM/PM or "Never"

**Actions (icon buttons per row):**
- Send/Resend Invitation (blue paper plane icon)
- Edit Role (amber pencil icon) - inline dropdown appears for selection
- Set Password (purple link icon) - opens modal to set new password
- Toggle Active (green circle, filled when active) - toggles status directly
- Delete (red trash icon) - requires confirmation click before executing

**New Features:**
- Set Password modal: admins can directly set a password for any user via the existing `admin-reset-password` edge function
- Inline role editing: click pencil, choose from dropdown, confirm with check
- Delete confirmation: click trash shows check/X before executing

**Removed:**
- Avatar/initials circle (not in reference design)
- "Pending Invite" badge (replaced by Invitation column showing sent count)
- Dropdown menu with multiple options (replaced by individual action icons)
