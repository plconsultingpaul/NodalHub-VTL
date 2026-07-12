import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { configId, recipientEmail } = await req.json();
    if (!configId) {
      return new Response(JSON.stringify({ error: "configId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: config, error: cfgErr } = await admin
      .from("email_configurations")
      .select("*")
      .eq("id", configId)
      .maybeSingle();

    if (cfgErr || !config) {
      return new Response(JSON.stringify({ error: cfgErr?.message || "Configuration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = config.credentials as Record<string, string>;
    const toAddress = recipientEmail || config.send_from_email;
    let token: string;

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
      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        return new Response(JSON.stringify({ error: `Gmail auth failed: ${errText}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tokenJson = await tokenRes.json();
      token = tokenJson.access_token;

      const raw = [
        `From: ${config.send_from_email}`,
        `To: ${toAddress}`,
        `Subject: Test Email - ${config.name}`,
        "Content-Type: text/plain; charset=UTF-8",
        "",
        `This is a test email from your "${config.name}" email configuration. If you received this, your Gmail setup is working correctly.`,
      ].join("\r\n");

      const encoded = btoa(unescape(encodeURIComponent(raw)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const sendRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: encoded }),
        }
      );

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        return new Response(JSON.stringify({ error: `Gmail send failed: ${errText}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        return new Response(JSON.stringify({ error: `O365 auth failed: ${errText}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tokenJson = await tokenRes.json();
      token = tokenJson.access_token;

      const message = {
        subject: `Test Email - ${config.name}`,
        body: {
          contentType: "Text",
          content: `This is a test email from your "${config.name}" email configuration. If you received this, your Office 365 setup is working correctly.`,
        },
        toRecipients: [{ emailAddress: { address: toAddress } }],
      };

      const sendRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.send_from_email)}/sendMail`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message, saveToSentItems: "true" }),
        }
      );

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        return new Response(JSON.stringify({ error: `O365 send failed: ${errText}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Test email sent to ${toAddress}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
