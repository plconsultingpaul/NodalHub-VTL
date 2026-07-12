/*
# Create invitation_email_templates table

1. New Tables
  - `invitation_email_templates`
    - `id` (uuid, primary key)
    - `template_name` (text) - Display name shown in UI
    - `template_type` (text, unique) - One of: admin_invitation, forgot_username, reset_password
    - `subject` (text) - Email subject line with variable support
    - `body_html` (text) - Full HTML email body with {{variable}} placeholders
    - `description` (text) - Short description shown on the template card
    - `is_default` (boolean) - Whether this is the system default (vs customized)
    - `company_id` (uuid, nullable) - If null, this is the global default template
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

2. Security
  - Enable RLS on `invitation_email_templates`
  - Authenticated users who are admins of any company can read templates
  - Authenticated users who are admins can update templates

3. Seed Data
  - Insert 3 default templates: Admin Invitation, Forgot Username, Reset Password
*/

CREATE TABLE IF NOT EXISTS invitation_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  template_type text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT true,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(template_type, company_id)
);

ALTER TABLE invitation_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_email_templates" ON invitation_email_templates;
CREATE POLICY "select_email_templates" ON invitation_email_templates FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = invitation_email_templates.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  );

DROP POLICY IF EXISTS "insert_email_templates" ON invitation_email_templates;
CREATE POLICY "insert_email_templates" ON invitation_email_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = invitation_email_templates.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  );

DROP POLICY IF EXISTS "update_email_templates" ON invitation_email_templates;
CREATE POLICY "update_email_templates" ON invitation_email_templates FOR UPDATE
  TO authenticated
  USING (
    company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = invitation_email_templates.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  )
  WITH CHECK (
    company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = invitation_email_templates.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  );

DROP POLICY IF EXISTS "delete_email_templates" ON invitation_email_templates;
CREATE POLICY "delete_email_templates" ON invitation_email_templates FOR DELETE
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM company_memberships
      WHERE company_memberships.company_id = invitation_email_templates.company_id
      AND company_memberships.user_id = auth.uid()
      AND company_memberships.role = 'Admin'
    )
  );

-- Seed default templates (global, company_id = NULL)
INSERT INTO invitation_email_templates (template_name, template_type, subject, body_html, description, is_default, company_id)
VALUES
(
  'Admin Invitation',
  'admin_invitation',
  'You have been invited to {{company_name}}',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;margin:0;padding:0;background:#f4f7fa}.container{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden}.header{background:#1e293b;padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.body{padding:32px}.body p{color:#334155;line-height:1.6;margin:0 0 16px}.btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;margin:16px 0}.footer{padding:24px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div class="container"><div class="header"><h1>Welcome to {{company_name}}</h1></div><div class="body"><p>Hello {{name}},</p><p>You have been invited to join <strong>{{company_name}}</strong>. Your username is: <strong>{{username}}</strong></p><p>Please click the button below to set your password and activate your account:</p><p style="text-align:center"><a href="{{reset_link}}" class="btn">Set Your Password</a></p><p>This link will expire in {{expiration_hours}} hours.</p><p>If you did not expect this invitation, you can safely ignore this email.</p></div><div class="footer"><p>This is an automated message. Please do not reply directly to this email.</p></div></div></body></html>',
  'Customize the email sent to new admin users',
  true,
  NULL
),
(
  'Forgot Username',
  'forgot_username',
  'Your username reminder',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;margin:0;padding:0;background:#f4f7fa}.container{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden}.header{background:#1e293b;padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.body{padding:32px}.body p{color:#334155;line-height:1.6;margin:0 0 16px}.username-box{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:16px;text-align:center;margin:16px 0}.username-box span{font-size:20px;font-weight:700;color:#1e293b}.footer{padding:24px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div class="container"><div class="header"><h1>Username Reminder</h1></div><div class="body"><p>Hello,</p><p>You requested a reminder of your username. Here it is:</p><div class="username-box"><span>{{username}}</span></div><p>You can use this username to log in to your account.</p><p>If you did not request this, you can safely ignore this email.</p></div><div class="footer"><p>This is an automated message. Please do not reply directly to this email.</p></div></div></body></html>',
  'Email sent when users request their username',
  true,
  NULL
),
(
  'Reset Password',
  'reset_password',
  'Reset your password',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;margin:0;padding:0;background:#f4f7fa}.container{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden}.header{background:#1e293b;padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.body{padding:32px}.body p{color:#334155;line-height:1.6;margin:0 0 16px}.btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;margin:16px 0}.footer{padding:24px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b}</style></head><body><div class="container"><div class="header"><h1>Password Reset</h1></div><div class="body"><p>Hello,</p><p>We received a request to reset your password. Click the button below to choose a new password:</p><p style="text-align:center"><a href="{{reset_link}}" class="btn">Reset Password</a></p><p>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p></div><div class="footer"><p>This is an automated message. Please do not reply directly to this email.</p></div></div></body></html>',
  'Email sent when users request a password reset',
  true,
  NULL
)
ON CONFLICT (template_type, company_id) DO NOTHING;
