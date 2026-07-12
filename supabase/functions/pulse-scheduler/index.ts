import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import parser from "npm:cron-parser@4.9.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const computeNextRun = (cronExpression: string, timezone: string): Date | null => {
  try {
    const interval = parser.parseExpression(cronExpression, { tz: timezone || "UTC" });
    return interval.next().toDate();
  } catch {
    return null;
  }
};

const computeNextRunAfter = (cronExpression: string, timezone: string, after: Date): Date | null => {
  try {
    const interval = parser.parseExpression(cronExpression, { tz: timezone || "UTC", currentDate: after });
    return interval.next().toDate();
  } catch {
    return null;
  }
};

const invokePulseRunner = async (supabaseUrl: string, serviceKey: string, pulseId: string): Promise<Record<string, unknown>> => {
  const runnerUrl = `${supabaseUrl}/functions/v1/pulse-runner`;
  try {
    const r = await fetch(runnerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pulseId, triggerSource: "schedule" }),
    });
    const body = await r.text();
    return { pulseId, status: r.status, ok: r.ok, body: body.slice(0, 500) };
  } catch (err) {
    return { pulseId, status: 0, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    const results: Array<Record<string, unknown>> = [];
    let invokedCount = 0;

    // --- V1: Legacy pulse_schedules table ---
    const { data: schedules, error: schedError } = await admin
      .from("pulse_schedules")
      .select("pulse_id, cron_expression, timezone, next_run_at, enabled")
      .eq("enabled", true);

    if (schedError) throw schedError;

    if (schedules && schedules.length > 0) {
      const pulseIds = schedules.map((s) => s.pulse_id);
      const { data: activePulses, error: pulseError } = await admin
        .from("pulses")
        .select("id, workflow_version")
        .in("id", pulseIds)
        .eq("is_active", true);

      if (pulseError) throw pulseError;

      // Only run v1 pulses from pulse_schedules (v2 pulses use step_configs)
      const v1ActiveIds = new Set(
        (activePulses || []).filter((p) => (p.workflow_version || 1) === 1).map((p) => p.id)
      );

      const due = schedules.filter((s) => {
        if (!v1ActiveIds.has(s.pulse_id)) return false;
        if (!s.next_run_at) return true;
        return new Date(s.next_run_at) <= now;
      });

      for (const s of due) {
        const next = computeNextRun(s.cron_expression, s.timezone);
        const updatePayload: Record<string, unknown> = {
          last_scheduled_at: now.toISOString(),
          updated_at: now.toISOString(),
        };
        if (next) updatePayload.next_run_at = next.toISOString();
        await admin.from("pulse_schedules").update(updatePayload).eq("pulse_id", s.pulse_id);

        const invocationResult = await invokePulseRunner(supabaseUrl, serviceKey, s.pulse_id);
        results.push({ pulseId: s.pulse_id, version: 1, scheduled_next: next?.toISOString() ?? null, invocation: invocationResult });
        invokedCount++;
      }
    }

    // --- V2: workflow_version=2 pulses with trigger config in step_configs ---
    const { data: v2Pulses, error: v2Err } = await admin
      .from("pulses")
      .select("id, step_configs, last_run_at")
      .eq("workflow_version", 2)
      .eq("is_active", true);

    if (v2Err) throw v2Err;

    for (const p of v2Pulses || []) {
      const stepConfigs = (p.step_configs || {}) as Record<string, Record<string, unknown>>;
      // Find trigger config
      const triggerConfig = Object.values(stepConfigs).find(
        (c) => c.stepType === "trigger"
      );
      if (!triggerConfig || !triggerConfig.cronExpression || !triggerConfig.active) continue;

      const cronExpr = triggerConfig.cronExpression as string;
      const timezone = (triggerConfig.timezone as string) || "UTC";

      // Check if due based on last_run_at
      if (p.last_run_at) {
        const lastRun = new Date(p.last_run_at);
        const nextAfterLast = computeNextRunAfter(cronExpr, timezone, lastRun);
        if (!nextAfterLast || nextAfterLast > now) continue;
      }

      const invocationResult = await invokePulseRunner(supabaseUrl, serviceKey, p.id);
      const next = computeNextRun(cronExpr, timezone);
      results.push({ pulseId: p.id, version: 2, scheduled_next: next?.toISOString() ?? null, invocation: invocationResult });
      invokedCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        invokedCount,
        nowISO: now.toISOString(),
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        stack: err instanceof Error ? err.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
