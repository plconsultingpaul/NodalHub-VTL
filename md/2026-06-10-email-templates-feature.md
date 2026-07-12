# 2026-06-10 Email Templates Feature

## Summary

Added the Email Templates section to the User Management page (Settings > Companies > Users). This allows administrators to view and customize the HTML email templates used for user invitations, username recovery, and password resets.

## Changes

### Database

- Created `invitation_email_templates` table with columns:
  - `id` (uuid, PK)
  - `template_name` (text) - Display name
  - `template_type` (text, unique per company) - One of: `admin_invitation`, `forgot_username`, `reset_password`
  - `subject` (text) - Email subject line supporting `{{variable}}` placeholders
  - `body_html` (text) - Full HTML email body with variable placeholders
  - `description` (text) - Short description shown on the template card
  - `is_default` (boolean) - Whether this is the unmodified system default
  - `company_id` (uuid, nullable) - NULL = global default template
  - `created_at`, `updated_at` (timestamptz)
- RLS policies: Admins can read/update all templates; company-specific templates scoped to company admins
- Seeded 3 default templates with professional HTML email designs

### Frontend (TeamMembers.tsx)

- Added **Email Templates** card section above the User Management table
- Each template displays as a card with mail icon, name, description, and edit button (clipboard icon)
- Clicking the edit button opens a **Template Editor Modal** with:
  - Subject line input
  - HTML body textarea (monospace font for code editing)
  - Available variables displayed per template type
  - **Preview** button - renders the template with sample data in an iframe
  - **Reset to Default** button - restores the original system template
  - **Save Template** button - persists customizations

### Template Variables

| Template | Available Variables |
|----------|-------------------|
| Admin Invitation | `{{name}}`, `{{username}}`, `{{reset_link}}`, `{{company_name}}`, `{{expiration_hours}}` |
| Forgot Username | `{{username}}` |
| Reset Password | `{{reset_link}}` |

## Integration Notes

The templates are stored in the database and ready for consumption by a custom email-sending service. Currently, the `invite-user` edge function uses Supabase Auth's built-in `inviteUserByEmail` which sends its own system email. When custom email sending (via Office365/Gmail/SMTP from the Email Settings page) is wired up, it will fetch the appropriate template, replace variables, and send the rendered HTML.
