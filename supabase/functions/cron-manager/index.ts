import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const trimRoute = (pathname: string): string => {
  const idx = pathname.indexOf("/cron-manager");
  if (idx === -1) return pathname;
  return pathname.slice(idx + "/cron-manager".length).replace(/\/$/, "") || "/";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: adminMembership } = await admin
      .from("company_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "Admin")
      .limit(1)
      .maybeSingle();
    if (!adminMembership) return json({ error: "Admin role required" }, 403);

    const url = new URL(req.url);
    const route = trimRoute(url.pathname);
    const method = req.method.toUpperCase();

    if (method === "GET" && (route === "/status" || route === "/")) {
      const { data, error } = await admin.rpc("get_pulse_scheduler_status");
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    if (method === "POST" && route === "/enable") {
      const { schedule } = await req.json().catch(() => ({}));
      if (!schedule || typeof schedule !== "string") {
        return json({ error: "schedule (cron expression) is required" }, 400);
      }
      const { data, error } = await admin.rpc("manage_pulse_scheduler_cron", {
        p_schedule: schedule,
      });
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    if (method === "POST" && route === "/disable") {
      const { data, error } = await admin.rpc("remove_pulse_scheduler_cron");
      if (error) return json({ error: error.message }, 500);
      return json(data);
    }

    if (method === "GET" && route === "/jobs") {
      const { data, error } = await admin.rpc("get_pulse_cron_jobs");
      if (error) return json({ error: error.message }, 500);
      return json(data || []);
    }

    if (method === "GET" && route === "/settings") {
      const { data, error } = await admin
        .from("system_configuration")
        .select("config_value")
        .eq("config_key", "scheduler_connection")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      const cfg = (data?.config_value || {}) as { supabase_url?: string; anon_key?: string };
      return json({
        supabase_url: cfg.supabase_url ?? "",
        anon_key_configured: Boolean(cfg.anon_key),
      });
    }

    if (method === "POST" && route === "/settings") {
      const body = await req.json().catch(() => ({}));
      let supabase_url = (body?.supabase_url || "").toString().trim().replace(/\/+$/, "");
      // Strip any path components - we only want the origin
      try {
        const parsed = new URL(supabase_url);
        supabase_url = parsed.origin;
      } catch { /* keep as-is if not a valid URL */ }
      const anon_key = (body?.anon_key || "").toString().trim();
      if (!supabase_url || !anon_key) {
        return json({ error: "supabase_url and anon_key are required" }, 400);
      }
      const { error } = await admin
        .from("system_configuration")
        .update({
          config_value: { supabase_url, anon_key },
          updated_at: new Date().toISOString(),
        })
        .eq("config_key", "scheduler_connection");
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (method === "POST" && route === "/test-connection") {
      const { data, error } = await admin
        .from("system_configuration")
        .select("config_value")
        .eq("config_key", "scheduler_connection")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      const cfg = (data?.config_value || {}) as { supabase_url?: string; anon_key?: string };
      if (!cfg.supabase_url || !cfg.anon_key) {
        return json({ success: false, error: "Connection settings not configured" }, 400);
      }
      try {
        const probe = await fetch(`${cfg.supabase_url}/functions/v1/pulse-scheduler`, {
          method: "OPTIONS",
          headers: { Authorization: `Bearer ${cfg.anon_key}` },
        });
        return json({ success: probe.ok, status: probe.status });
      } catch (err) {
        return json({
          success: false,
          error: err instanceof Error ? err.message : "Connection failed",
        });
      }
    }

    return json({ error: `Unknown route: ${method} ${route}` }, 404);
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
});
