import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jwtVerify } from "npm:jose@5";

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ssoSecret = Deno.env.get("SSO_SHARED_SECRET");
    const currentAppId = Deno.env.get("SSO_CURRENT_APP_ID") || "unknown";

    console.log("[SSO] verify-sso-token called");
    console.log("[SSO] currentAppId:", currentAppId);
    console.log("[SSO] ssoSecret configured:", !!ssoSecret);
    console.log("[SSO] ssoSecret length:", ssoSecret?.length || 0);

    if (!ssoSecret) {
      console.log("[SSO] ERROR: SSO_SHARED_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "SSO_SHARED_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { ticket } = await req.json();
    if (!ticket) {
      console.log("[SSO] ERROR: No ticket in request body");
      return new Response(
        JSON.stringify({ error: "Missing ticket" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SSO] Ticket received, length:", ticket.length);
    console.log("[SSO] Ticket preview:", ticket.substring(0, 50) + "...");

    const secret = new TextEncoder().encode(ssoSecret);

    let payload;
    try {
      const result = await jwtVerify(ticket, secret, {
        audience: currentAppId,
      });
      payload = result.payload;
      console.log("[SSO] JWT verified successfully");
      console.log("[SSO] JWT payload - email:", payload.email);
      console.log("[SSO] JWT payload - iss:", payload.iss);
      console.log("[SSO] JWT payload - aud:", payload.aud);
    } catch (jwtError) {
      console.log("[SSO] ERROR: JWT verification failed:", jwtError instanceof Error ? jwtError.message : String(jwtError));
      console.log("[SSO] Expected audience:", currentAppId);
      return new Response(
        JSON.stringify({ error: "Invalid or expired ticket", details: jwtError instanceof Error ? jwtError.message : "verification failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = payload.email as string;
    if (!email) {
      console.log("[SSO] ERROR: No email in JWT payload");
      return new Response(
        JSON.stringify({ error: "Invalid ticket payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[SSO] Checking if user exists:", email);
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.log("[SSO] ERROR: listUsers failed:", listError.message);
      return new Response(
        JSON.stringify({ error: "Failed to verify user existence" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!existingUser) {
      console.log("[SSO] ERROR: User not found in this application:", email);
      return new Response(
        JSON.stringify({ error: "User not registered in this application" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SSO] User found, id:", existingUser.id);
    console.log("[SSO] Generating magic link for email:", email);

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError) {
      console.log("[SSO] ERROR: generateLink failed:", linkError.message);
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SSO] Magic link generated successfully");
    console.log("[SSO] linkData.properties keys:", Object.keys(linkData?.properties || {}));

    const tokenHash = linkData?.properties?.hashed_token;
    console.log("[SSO] hashed_token:", tokenHash ? `${tokenHash.substring(0, 20)}...` : "NULL");

    if (!tokenHash) {
      console.log("[SSO] ERROR: No hashed_token in generateLink response");
      console.log("[SSO] properties:", JSON.stringify(linkData?.properties));
      return new Response(
        JSON.stringify({ error: "Failed to extract token hash" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SSO] SUCCESS - returning hashed_token");
    return new Response(
      JSON.stringify({ tokenHash }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.log("[SSO] UNCAUGHT ERROR:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
