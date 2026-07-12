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

    const { configId, to, cc, bcc, subject, message, csvContent, filename } = await req.json();

    if (!configId || !to || !csvContent || !filename) {
      return new Response(
        JSON.stringify({ error: "configId, to, csvContent, and filename are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: config, error: cfgErr } = await admin
      .from("email_configurations")
      .select("*")
      .eq("id", configId)
      .maybeSingle();

    if (cfgErr || !config) {
      return new Response(
        JSON.stringify({ error: cfgErr?.message || "Configuration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creds = config.credentials as Record<string, string>;
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));

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
        return new Response(
          JSON.stringify({ error: `Gmail auth failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenJson = await tokenRes.json();
      const token = tokenJson.access_token;

      const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");
      const toAddresses = to.split(/[,;]\s*/).filter(Boolean);
      const ccAddresses = cc ? cc.split(/[,;]\s*/).filter(Boolean) : [];
      const bccAddresses = bcc ? bcc.split(/[,;]\s*/).filter(Boolean) : [];

      const headers = [
        `From: ${config.send_from_email}`,
        `To: ${toAddresses.join(", ")}`,
      ];
      if (ccAddresses.length) headers.push(`Cc: ${ccAddresses.join(", ")}`);
      if (bccAddresses.length) headers.push(`Bcc: ${bccAddresses.join(", ")}`);
      headers.push(`Subject: ${subject || "Report"}`);
      headers.push("MIME-Version: 1.0");
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

      const bodyText = message || "Please find the attached report.";

      const raw = [
        ...headers,
        "",
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "",
        bodyText,
        `--${boundary}`,
        `Content-Type: text/csv; name="${filename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${filename}"`,
        "",
        csvBase64,
        `--${boundary}--`,
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
        return new Response(
          JSON.stringify({ error: `Gmail send failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
        return new Response(
          JSON.stringify({ error: `O365 auth failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenJson = await tokenRes.json();
      const token = tokenJson.access_token;

      const toAddresses = to.split(/[,;]\s*/).filter(Boolean);
      const ccAddresses = cc ? cc.split(/[,;]\s*/).filter(Boolean) : [];
      const bccAddresses = bcc ? bcc.split(/[,;]\s*/).filter(Boolean) : [];

      const emailMessage: Record<string, unknown> = {
        subject: subject || "Report",
        body: {
          contentType: "Text",
          content: message || "Please find the attached report.",
        },
        toRecipients: toAddresses.map((addr: string) => ({ emailAddress: { address: addr } })),
        attachments: [
          {
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: filename,
            contentType: "text/csv",
            contentBytes: csvBase64,
          },
        ],
      };

      if (ccAddresses.length) {
        emailMessage.ccRecipients = ccAddresses.map((addr: string) => ({ emailAddress: { address: addr } }));
      }
      if (bccAddresses.length) {
        emailMessage.bccRecipients = bccAddresses.map((addr: string) => ({ emailAddress: { address: addr } }));
      }

      const sendRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.send_from_email)}/sendMail`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: emailMessage, saveToSentItems: "true" }),
        }
      );

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        return new Response(
          JSON.stringify({ error: `O365 send failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${to}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
