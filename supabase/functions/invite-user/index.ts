import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PermissionEntry {
  permission_type: "dashboard" | "pulse" | "settings_tab";
  resource_id: string | null;
  access_level: "view" | "edit" | "access";
}

interface InviteRequest {
  email: string;
  username?: string;
  fullName?: string;
  companyId: string;
  role: "Admin" | "User";
  redirectUrl?: string;
  resend?: boolean;
  membershipId?: string;
  permissions?: PermissionEntry[];
}

async function getEmailConfig(adminClient: ReturnType<typeof createClient>, companyId: string) {
  const { data } = await adminClient
    .from("email_configurations")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_default", true)
    .maybeSingle();

  if (data) return data;

  const { data: any } = await adminClient
    .from("email_configurations")
    .select("*")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();

  return any;
}

async function getEmailTemplate(adminClient: ReturnType<typeof createClient>, templateType: string) {
  const { data } = await adminClient
    .from("invitation_email_templates")
    .select("*")
    .eq("template_type", templateType)
    .is("company_id", null)
    .maybeSingle();

  return data;
}

function replaceTemplateVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

async function sendEmail(
  config: { provider: string; send_from_email: string; credentials: Record<string, string> },
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  const creds = config.credentials;

  if (config.provider === "gmail") {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        refresh_token: creds.refresh_token,
      }),
    });
    if (!tokenRes.ok) return { success: false, error: "Gmail auth failed" };
    const { access_token } = await tokenRes.json();

    const raw = [
      `From: ${config.send_from_email}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "",
      htmlBody,
    ].join("\r\n");

    const encoded = btoa(unescape(encodeURIComponent(raw)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encoded }),
      }
    );
    if (!sendRes.ok) return { success: false, error: "Gmail send failed" };
    return { success: true };
  } else {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${creds.tenant_id}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: creds.client_id,
          client_secret: creds.client_secret,
          scope: "https://graph.microsoft.com/.default",
        }),
      }
    );
    if (!tokenRes.ok) return { success: false, error: "O365 auth failed" };
    const { access_token } = await tokenRes.json();

    const message = {
      subject,
      body: { contentType: "HTML", content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }],
    };

    const sendRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.send_from_email)}/sendMail`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message, saveToSentItems: "true" }),
      }
    );
    if (!sendRes.ok) return { success: false, error: "O365 send failed" };
    return { success: true };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, username, fullName, companyId, role, redirectUrl, resend, membershipId, permissions }: InviteRequest = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "Missing company ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: membership } = await adminClient
      .from("company_memberships")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", requestingUser.id)
      .maybeSingle();

    if (!membership || membership.role !== "Admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can invite users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: company } = await adminClient
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    const companyName = company?.name || "Your Company";

    if (resend && membershipId) {
      const { data: existingMembership } = await adminClient
        .from("company_memberships")
        .select("user_id, invitation_sent_count")
        .eq("id", membershipId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!existingMembership) {
        return new Response(
          JSON.stringify({ error: "Membership not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: userProfile } = await adminClient
        .from("profiles")
        .select("email, full_name, username")
        .eq("id", existingMembership.user_id)
        .maybeSingle();

      if (!userProfile) {
        return new Response(
          JSON.stringify({ error: "User profile not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const redirectTo = redirectUrl ? `${redirectUrl.replace(/\/$/, '')}/reset-password` : undefined;

      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email: userProfile.email,
        options: { redirectTo },
      });

      if (linkError) {
        return new Response(
          JSON.stringify({ error: linkError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const resetLink = linkData?.properties?.action_link || redirectTo || "#";

      const emailConfig = await getEmailConfig(adminClient, companyId);
      const template = await getEmailTemplate(adminClient, "admin_invitation");

      if (emailConfig && template) {
        const vars = {
          name: userProfile.full_name || userProfile.username || "User",
          username: userProfile.username || userProfile.email,
          reset_link: resetLink,
          company_name: companyName,
          expiration_hours: "48",
        };

        const renderedSubject = replaceTemplateVars(template.subject, vars);
        const renderedBody = replaceTemplateVars(template.body_html, vars);
        await sendEmail(emailConfig, userProfile.email, renderedSubject, renderedBody);
      }

      await adminClient
        .from("company_memberships")
        .update({
          invitation_sent_at: new Date().toISOString(),
          invitation_sent_count: (existingMembership.invitation_sent_count || 0) + 1,
        })
        .eq("id", membershipId);

      return new Response(
        JSON.stringify({ success: true, message: "Invitation resent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      const { data: existingMembership } = await adminClient
        .from("company_memberships")
        .select("id")
        .eq("company_id", companyId)
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (existingMembership) {
        return new Response(
          JSON.stringify({ error: "User is already a member of this company" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminClient.from("company_memberships").insert({
        company_id: companyId,
        user_id: existingProfile.id,
        role: role,
        invitation_sent_at: new Date().toISOString(),
        invitation_sent_count: 1,
      }).then(({ error }) => { if (error) throw new Error(`Membership insert failed: ${error.message}`); });

      if (permissions && permissions.length > 0 && role !== "Admin") {
        const permRows = permissions.map(p => ({
          user_id: existingProfile.id,
          company_id: companyId,
          permission_type: p.permission_type,
          resource_id: p.resource_id,
          access_level: p.access_level,
        }));
        await adminClient.from("user_permissions").insert(permRows);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Existing user added to company" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const redirectTo = redirectUrl ? `${redirectUrl.replace(/\/$/, '')}/reset-password` : undefined;

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email: email.toLowerCase(),
      options: {
        data: {
          pending_company_id: companyId,
          pending_role: role,
          full_name: fullName || "",
        },
        redirectTo,
      },
    });

    if (linkError) {
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = linkData?.user?.id;
    const resetLink = linkData?.properties?.action_link || redirectTo || "#";

    if (userId) {
      if (fullName) {
        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: { full_name: fullName },
        });
      }

      await adminClient
        .from("profiles")
        .upsert({
          id: userId,
          email: email.toLowerCase(),
          full_name: fullName || "",
          username: username || null,
        }, { onConflict: "id" });

      const { data: existingMembership } = await adminClient
        .from("company_memberships")
        .select("id")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingMembership) {
        const { error: insertError } = await adminClient.from("company_memberships").insert({
          company_id: companyId,
          user_id: userId,
          role: role,
          status: "active",
          invitation_sent_at: new Date().toISOString(),
          invitation_sent_count: 1,
        });
        if (insertError) throw new Error(`Membership insert failed: ${insertError.message}`);
      } else {
        await adminClient
          .from("company_memberships")
          .update({
            invitation_sent_at: new Date().toISOString(),
            invitation_sent_count: 1,
          })
          .eq("id", existingMembership.id);
      }

      if (permissions && permissions.length > 0 && role !== "Admin") {
        await adminClient
          .from("user_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("company_id", companyId);

        const permRows = permissions.map(p => ({
          user_id: userId,
          company_id: companyId,
          permission_type: p.permission_type,
          resource_id: p.resource_id,
          access_level: p.access_level,
        }));
        await adminClient.from("user_permissions").insert(permRows);
      }

      const emailConfig = await getEmailConfig(adminClient, companyId);
      const template = await getEmailTemplate(adminClient, "admin_invitation");
      let emailSent = false;
      let emailError: string | undefined;

      if (emailConfig && template) {
        const vars = {
          name: fullName || username || "User",
          username: username || email,
          reset_link: resetLink,
          company_name: companyName,
          expiration_hours: "48",
        };

        const renderedSubject = replaceTemplateVars(template.subject, vars);
        const renderedBody = replaceTemplateVars(template.body_html, vars);
        const result = await sendEmail(emailConfig, email.toLowerCase(), renderedSubject, renderedBody);
        emailSent = result.success;
        emailError = result.error;
      } else {
        emailError = !emailConfig ? "No email configuration found" : "No email template found";
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "User created successfully", userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
