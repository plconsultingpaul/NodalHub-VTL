import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RunRequest {
  pulseId: string;
  triggerSource?: "manual" | "schedule";
  input_variables?: Record<string, string>;
  triggered_by?: "manual" | "schedule" | "cell_action";
}

interface QueryParameter {
  key: string;
  value: string;
  enabled: boolean;
}

const flattenRows = (data: unknown): Record<string, unknown>[] => {
  if (Array.isArray(data)) {
    return data.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === "object") {
        return val.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
      }
    }
    // Fallback: check for any array property even if empty
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        return obj[key] as Record<string, unknown>[];
      }
    }
  }
  return [];
};

const resolveTokens = (
  template: string,
  ctx: { pulseName: string; date: string; group: string; rowCount: number; resultsTable?: string }
) =>
  (template || "")
    .replace(/\{pulse_name\}/g, ctx.pulseName)
    .replace(/\{date\}/g, ctx.date)
    .replace(/\{group\}/g, ctx.group)
    .replace(/\{row_count\}/g, String(ctx.rowCount))
    .replace(/\{results_table\}/g, ctx.resultsTable || "");

const formatDateCell = (value: unknown, format: string): string | null => {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value);
  const date = new Date(str);
  if (isNaN(date.getTime())) return null;

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");

  const d = date.getDate(), m = date.getMonth(), y = date.getFullYear(), day = date.getDay();
  const h24 = date.getHours(), h12 = h24 % 12 || 12, min = date.getMinutes(), sec = date.getSeconds();
  const ampm = h24 >= 12 ? "pm" : "am";
  const yy = String(y).slice(-2);

  let result = format;
  result = result.replace("dddd", DAY_NAMES[day]);
  result = result.replace("ddd", DAY_SHORT[day]);
  result = result.replace("DD", pad(d));
  result = result.replace("D", String(d));
  result = result.replace("MMMM", MONTH_NAMES[m]);
  result = result.replace("MMM", MONTH_SHORT[m]);
  result = result.replace("MM", pad(m + 1));
  result = result.replace("YYYY", String(y));
  result = result.replace("YY", yy);
  result = result.replace("HH", pad(h24));
  result = result.replace("hh", pad(h12));
  result = result.replace("h", String(h12));
  result = result.replace("mm", pad(min));
  result = result.replace("ss", pad(sec));
  result = result.replace("a", ampm);
  result = result.replace("A", ampm.toUpperCase());
  return result;
};

const buildHtmlTable = (
  rows: Record<string, unknown>[],
  columns: string[] | null,
  columnAliases?: Record<string, string> | null,
  includeHeaderRow?: boolean,
  columnFormats?: Record<string, string> | null
): string => {
  if (rows.length === 0) return "<p><em>No results</em></p>";
  const cols = columns && columns.length > 0
    ? columns
    : Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };
  const formatCell = (col: string, value: unknown): string => {
    const fmt = columnFormats?.[col];
    if (fmt) {
      const formatted = formatDateCell(value, fmt);
      if (formatted !== null) return esc(formatted);
    }
    return esc(value);
  };
  const showHeader = includeHeaderRow !== false;
  const headerRow = showHeader
    ? `<tr>${cols.map((c) => {
        const display = columnAliases?.[c] || c;
        return `<th style="border:1px solid #ddd;padding:6px 10px;background:#f4f4f4;text-align:left;font-size:13px;">${esc(display)}</th>`;
      }).join("")}</tr>`
    : "";
  const bodyRows = rows
    .map(
      (row, i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : "#fafafa"}">${cols
          .map((c) => `<td style="border:1px solid #ddd;padding:5px 10px;font-size:13px;">${formatCell(c, row[c])}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">${headerRow}${bodyRows}</table>`;
};

const buildCsv = (rows: Record<string, unknown>[], includeHeaders: boolean): string => {
  if (rows.length === 0) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (val: unknown) => {
    if (val === null || val === undefined) return "";
    const s = typeof val === "object" ? JSON.stringify(val) : String(val);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  if (includeHeaders) lines.push(cols.map(escape).join(","));
  for (const row of rows) {
    lines.push(cols.map((c) => escape(row[c])).join(","));
  }
  return lines.join("\n");
};

const buildXlsxBytes = (rows: Record<string, unknown>[], includeHeaders: boolean): Uint8Array => {
  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: !includeHeaders });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pulse");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buf);
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const DATE_FUNCTION_PREFIX = "fn::";

const computeDateFunctionValue = (
  baseDate: string,
  stringFormat: string,
  adjustYears: number,
  adjustMonths: number,
  adjustDays: number
): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const dayOfWeek = now.getDay();

  let base: Date;
  switch (baseDate) {
    case "today": base = new Date(now); break;
    case "today_date_only": base = new Date(year, month, day); break;
    case "first_day_of_month": base = new Date(year, month, 1); break;
    case "last_day_of_month": base = new Date(year, month + 1, 0); break;
    case "first_day_of_week": base = new Date(year, month, day - dayOfWeek); break;
    case "last_day_of_week": base = new Date(year, month, day + (6 - dayOfWeek)); break;
    case "first_day_of_year": base = new Date(year, 0, 1); break;
    case "last_day_of_year": base = new Date(year, 11, 31); break;
    case "first_day_of_last_month": base = new Date(year, month - 1, 1); break;
    case "last_day_of_last_month": base = new Date(year, month, 0); break;
    case "first_day_of_last_year": base = new Date(year - 1, 0, 1); break;
    case "last_day_of_last_year": base = new Date(year - 1, 11, 31); break;
    default: base = new Date(year, month, day);
  }

  if (adjustYears) base.setFullYear(base.getFullYear() + adjustYears);
  if (adjustMonths) base.setMonth(base.getMonth() + adjustMonths);
  if (adjustDays) base.setDate(base.getDate() + adjustDays);

  const y = base.getFullYear();
  const m = base.getMonth() + 1;
  const d = base.getDate();
  const hh = base.getHours();
  const mm = base.getMinutes();
  const ss = base.getSeconds();
  const pad = (n: number) => String(n).padStart(2, "0");

  switch (stringFormat) {
    case "MM/DD/YYYY": return `${pad(m)}/${pad(d)}/${y}`;
    case "DD/MM/YYYY": return `${pad(d)}/${pad(m)}/${y}`;
    case "YYYY-MM-DDTHH:mm:ss": return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
    case "MM-DD-YYYY": return `${pad(m)}-${pad(d)}-${y}`;
    case "YYYYMMDD": return `${y}${pad(m)}${pad(d)}`;
    default: return `${y}-${pad(m)}-${pad(d)}`;
  }
};

const buildQueryUrl = (
  baseUrl: string,
  subPath: string,
  params: QueryParameter[],
  urlQueryString: string,
  paramValues: Record<string, string> = {},
  pathVariableConfig: Record<string, string> = {}
): string => {
  const cleanBase = (baseUrl || "").replace(/\/$/, "");
  let cleanSub = (subPath || "").replace(/^\//, "").replace(/\/$/, "");
  // Substitute from stored path_variable_config first
  if (Object.keys(pathVariableConfig).length > 0) {
    Object.entries(pathVariableConfig).forEach(([varName, configValue]) => {
      if (configValue) {
        const dynamicMatch = configValue.match(/\{\{([^}]+)\}\}/);
        let resolved = configValue;
        if (dynamicMatch) {
          resolved = paramValues[`@${dynamicMatch[1]}`] || paramValues[dynamicMatch[1]] || configValue;
        }
        cleanSub = cleanSub.replace(
          new RegExp(`\\{${varName}\\}`, "g"),
          encodeURIComponent(resolved)
        );
      }
    });
  }
  // Substitute path parameters like {paramName} from @paramName values
  Object.entries(paramValues).forEach(([name, val]) => {
    const paramName = name.replace(/^@/, "");
    cleanSub = cleanSub.replace(
      new RegExp(`\\{${paramName}\\}`, "g"),
      encodeURIComponent(val)
    );
  });
  let url = cleanSub ? `${cleanBase}/${cleanSub}` : cleanBase;
  if (urlQueryString) {
    url += `?${substituteParams(urlQueryString, paramValues)}`;
  } else if (Array.isArray(params)) {
    const enabled = params.filter((p) => p && p.enabled && p.value);
    if (enabled.length) {
      const qs = enabled
        .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(substituteParams(p.value, paramValues))}`)
        .join("&");
      url += `?${qs}`;
    }
  }
  return url;
};

const substituteParams = (value: string, params: Record<string, string>): string => {
  let result = value;
  Object.entries(params).forEach(([name, val]) => {
    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    result = result.replace(regex, val);
  });
  return result;
};

const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown) => {
  const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextArray = /^\d+$/.test(nextPart);
    if (!(part in current)) {
      current[part] = isNextArray ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
};

const convertFieldValue = (value: string, dataType: string): unknown => {
  switch (dataType) {
    case "integer": return parseInt(value, 10) || 0;
    case "double": return parseFloat(value) || 0;
    case "boolean": return value.toLowerCase() === "true";
    case "date": return value;
    default: return value;
  }
};

const buildAuthHeaders = (endpoint: Record<string, unknown>): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((endpoint.headers as Record<string, string>) || {}),
  };
  const cfg = (endpoint.auth_config as Record<string, string>) || {};
  if (endpoint.auth_type === "bearer" && cfg.token) {
    headers["Authorization"] = `Bearer ${cfg.token}`;
  } else if (endpoint.auth_type === "api_key" && cfg.header_name && cfg.api_key) {
    headers[cfg.header_name] = cfg.api_key;
  } else if (endpoint.auth_type === "basic" && cfg.username && cfg.password) {
    headers["Authorization"] = `Basic ${btoa(`${cfg.username}:${cfg.password}`)}`;
  }
  return headers;
};

const getO365Token = async (credentials: {
  tenant_id: string;
  client_id: string;
  client_secret: string;
}): Promise<string> => {
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${credentials.tenant_id}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!tokenRes.ok) {
    throw new Error(`O365 token failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const json = await tokenRes.json();
  return json.access_token;
};

const getGmailToken = async (credentials: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}): Promise<string> => {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Gmail token failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const json = await tokenRes.json();
  return json.access_token;
};

interface SendEmailArgs {
  fromEmail: string;
  token: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachment?: { name: string; contentType: string; base64: string };
}

const sendO365Email = async (args: SendEmailArgs): Promise<void> => {
  const message: Record<string, unknown> = {
    subject: args.subject,
    body: { contentType: args.isHtml ? "HTML" : "Text", content: args.body },
    toRecipients: args.to.map((a) => ({ emailAddress: { address: a } })),
    ccRecipients: args.cc.map((a) => ({ emailAddress: { address: a } })),
    bccRecipients: args.bcc.map((a) => ({ emailAddress: { address: a } })),
  };
  if (args.attachment) {
    message.attachments = [
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: args.attachment.name,
        contentType: args.attachment.contentType,
        contentBytes: args.attachment.base64,
      },
    ];
  }
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(args.fromEmail)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: "true" }),
    }
  );
  if (!res.ok) {
    throw new Error(`Send email failed: ${res.status} ${await res.text()}`);
  }
};

const encodeRfc2047 = (text: string): string => {
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  const encoded = btoa(unescape(encodeURIComponent(text)));
  return `=?UTF-8?B?${encoded}?=`;
};

const buildRfc2822 = (args: SendEmailArgs): string => {
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
  const lines: string[] = [];
  lines.push(`From: ${args.fromEmail}`);
  lines.push(`To: ${args.to.join(", ")}`);
  if (args.cc.length) lines.push(`Cc: ${args.cc.join(", ")}`);
  if (args.bcc.length) lines.push(`Bcc: ${args.bcc.join(", ")}`);
  lines.push(`Subject: ${encodeRfc2047(args.subject)}`);
  lines.push("MIME-Version: 1.0");
  const bodyContentType = args.isHtml ? "text/html; charset=UTF-8" : "text/plain; charset=UTF-8";

  if (args.attachment) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${bodyContentType}`);
    lines.push("");
    lines.push(args.body);
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${args.attachment.contentType}; name="${args.attachment.name}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(`Content-Disposition: attachment; filename="${args.attachment.name}"`);
    lines.push("");
    lines.push(args.attachment.base64);
    lines.push(`--${boundary}--`);
  } else {
    lines.push(`Content-Type: ${bodyContentType}`);
    lines.push("");
    lines.push(args.body);
  }

  return lines.join("\r\n");
};

const sendGmailEmail = async (args: SendEmailArgs): Promise<void> => {
  const raw = buildRfc2822(args);
  const encoded = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    }
  );
  if (!res.ok) {
    throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let executionId: string | null = null;
  let pulseId: string | null = null;

  try {
    const { pulseId: reqPulseId, triggerSource = "manual", input_variables: inputVars, triggered_by }: RunRequest = await req.json();
    pulseId = reqPulseId;
    if (!pulseId) throw new Error("pulseId is required");

    console.log("[pulse-runner] === ENTRY ===");
    console.log("[pulse-runner] pulseId:", pulseId);
    console.log("[pulse-runner] triggered_by:", triggered_by);
    console.log("[pulse-runner] triggerSource:", triggerSource);
    console.log("[pulse-runner] input_variables:", JSON.stringify(inputVars));

    const effectiveTriggerSource = triggered_by || triggerSource;

    const { data: pulse, error: pulseErr } = await admin
      .from("pulses")
      .select("*")
      .eq("id", pulseId)
      .maybeSingle();
    if (pulseErr || !pulse) throw new Error(pulseErr?.message || "Pulse not found");

    console.log("[pulse-runner] Pulse found:", {
      name: pulse.name,
      workflow_version: pulse.workflow_version,
      has_canvas_data: !!pulse.canvas_data,
      has_step_configs: !!pulse.step_configs,
      query_id: pulse.query_id,
      trigger_type: pulse.trigger_type,
    });

    const { data: execRow } = await admin
      .from("pulse_executions")
      .insert({
        pulse_id: pulseId,
        status: "running",
        trigger_source: effectiveTriggerSource,
        result_summary: {},
      })
      .select()
      .maybeSingle();
    executionId = execRow?.id ?? null;

    // --- V2 WORKFLOW EXECUTION ---
    if (pulse.workflow_version === 2 && pulse.canvas_data && pulse.step_configs) {
      console.log("[pulse-runner] Taking V2 WORKFLOW path");
      const canvasData = pulse.canvas_data as { nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data?: { label?: string } }>; edges: Array<{ id: string; source: string; target: string; sourceHandle?: string }> };
      const stepConfigs = pulse.step_configs as Record<string, Record<string, unknown>>;
      const { nodes, edges } = canvasData;

      // Build adjacency: nodeId -> list of { targetId, sourceHandle }
      const adjacency = new Map<string, Array<{ target: string; sourceHandle?: string }>>();
      for (const edge of edges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
        adjacency.get(edge.source)!.push({ target: edge.target, sourceHandle: edge.sourceHandle });
      }

      // Find start node (trigger)
      const triggerNode = nodes.find(n => n.type === "trigger");
      if (!triggerNode) throw new Error("Workflow has no trigger node");

      // Execution context: variables accumulated from API steps
      const context: Record<string, unknown> = {};
      // Inject input variables from cell action trigger
      const inputVariables: Record<string, string> = inputVars || {};
      if (Object.keys(inputVariables).length > 0) {
        context["var"] = inputVariables;
      }
      const stepResults: Array<Record<string, unknown>> = [];

      // BFS/topological execution following edges
      const executeNode = async (nodeId: string): Promise<void> => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        const config = stepConfigs[nodeId];
        const stepStart = new Date().toISOString();

        const stepName = node.data?.label || node.type;

        if (node.type === "trigger") {
          stepResults.push({ nodeId, name: stepName, type: "trigger", status: "success", startedAt: stepStart, finishedAt: new Date().toISOString() });
          // Follow edges from trigger
          const nextEdges = adjacency.get(nodeId) || [];
          for (const edge of nextEdges) {
            await executeNode(edge.target);
          }
        } else if ((node.type === "query" || node.type === "apiEndpoint") && config) {
          try {
            const queryId = config.queryId as string;
            if (!queryId) throw new Error("API step has no query configured");

            const { data: query, error: qErr } = await admin
              .from("queries")
              .select("*, api_endpoints(*)")
              .eq("id", queryId)
              .maybeSingle();
            if (qErr || !query) throw new Error(qErr?.message || "Query not found");
            const endpoint = query.api_endpoints as Record<string, unknown> | null;
            if (!endpoint) throw new Error("Query has no API endpoint");

            // Resolve parameter values from config
            const rawParamValues = (config.parameterValues || {}) as Record<string, string>;
            const fnRefs = Object.entries(rawParamValues).filter(([, v]) => v.startsWith(DATE_FUNCTION_PREFIX));
            let paramValues = rawParamValues;
            if (fnRefs.length > 0) {
              const fnIds = fnRefs.map(([, v]) => v.slice(DATE_FUNCTION_PREFIX.length));
              const { data: fns } = await admin
                .from("date_functions")
                .select("id, base_date, string_format, adjust_years, adjust_months, adjust_days")
                .in("id", fnIds);
              const fnMap = new Map((fns || []).map((f: Record<string, unknown>) => [f.id as string, f]));
              const resolved: Record<string, string> = { ...rawParamValues };
              fnRefs.forEach(([key, val]) => {
                const fnId = val.slice(DATE_FUNCTION_PREFIX.length);
                const fn = fnMap.get(fnId);
                if (fn) {
                  resolved[key] = computeDateFunctionValue(fn.base_date as string, fn.string_format as string, fn.adjust_years as number, fn.adjust_months as number, fn.adjust_days as number);
                } else {
                  resolved[key] = "";
                }
              });
              paramValues = resolved;
            }

            // Substitute {{varName}} from input variables in parameter values
            if (Object.keys(inputVariables).length > 0) {
              const substituted: Record<string, string> = {};
              for (const [key, val] of Object.entries(paramValues)) {
                substituted[key] = val.replace(/\{\{(.+?)\}\}/g, (_m, varName) => {
                  if (varName in inputVariables) return inputVariables[varName];
                  return _m;
                });
              }
              paramValues = substituted;
            }

            const url = buildQueryUrl(
              endpoint.url as string,
              query.api_sub_path || "",
              (query.query_parameters || []) as QueryParameter[],
              query.url_query_string || "",
              paramValues,
              (query.path_variable_config || {}) as Record<string, string>
            );
            const headers = buildAuthHeaders(endpoint);
            const fetchOptions: RequestInit = { method: query.http_method, headers };
            if (["POST", "PUT", "PATCH"].includes(query.http_method)) {
              if (query.request_body_template) {
                try {
                  const body = JSON.parse(query.request_body_template);
                  const mappings = (query.request_body_field_mappings || []) as Array<{ fieldName: string; value: string; type: string; dataType: string }>;
                  mappings.forEach((mapping) => {
                    let resolvedValue = mapping.value;
                    if (mapping.type === "parameter" && mapping.value) {
                      resolvedValue = paramValues[mapping.value] || "";
                    } else if (mapping.type === "hardcoded") {
                      resolvedValue = substituteParams(resolvedValue, paramValues);
                    }
                    // Substitute {{varName}} from input variables
                    if (Object.keys(inputVariables).length > 0) {
                      resolvedValue = resolvedValue.replace(/\{\{(.+?)\}\}/g, (_m, varName) => {
                        if (varName in inputVariables) return inputVariables[varName];
                        return _m;
                      });
                    }
                    setNestedValue(body, mapping.fieldName, convertFieldValue(resolvedValue, mapping.dataType));
                  });
                  fetchOptions.body = JSON.stringify(body);
                } catch { /* fall through */ }
              }
              if (!fetchOptions.body && query.json_parameters && Object.keys(query.json_parameters).length) {
                fetchOptions.body = substituteParams(JSON.stringify(query.json_parameters), paramValues);
              }
              if (!fetchOptions.body && (endpoint.endpoint_type === "nodal_connect" || query.nodal_db_connection_id)) {
                const inputs: Record<string, string> = {};
                Object.entries(paramValues).forEach(([key, val]) => {
                  inputs[key.replace(/^@/, "")] = val;
                });
                fetchOptions.body = JSON.stringify({ name: query.name, inputs });
              }
            }

            const apiRes = await fetch(url, fetchOptions);
            const apiText = await apiRes.text();
            if (!apiRes.ok) {
              const onError = config.onError || "stop";
              if (onError === "stop") throw new Error(`API call failed (${apiRes.status}): ${apiText.slice(0, 300)}`);
              context[config.responseVariableName as string || nodeId] = null;
              stepResults.push({ nodeId, name: stepName, type: "query", status: "error", error: `HTTP ${apiRes.status}`, inputs: { url, method: query.http_method, parameters: paramValues }, startedAt: stepStart, finishedAt: new Date().toISOString() });
            } else {
              let apiData: unknown;
              try { apiData = JSON.parse(apiText); } catch { apiData = { rawResponse: apiText }; }

              // Extract via responsePath if configured
              if (config.responsePath) {
                const parts = (config.responsePath as string).split(".");
                let extracted: unknown = apiData;
                for (const part of parts) {
                  if (extracted && typeof extracted === "object") {
                    extracted = (extracted as Record<string, unknown>)[part];
                  } else {
                    extracted = undefined;
                    break;
                  }
                }
                apiData = extracted;
              }

              const varName = (config.responseVariableName as string) || nodeId;
              context[varName] = apiData;
              const rows = flattenRows(apiData);
              stepResults.push({ nodeId, name: stepName, type: "query", status: "success", rowCount: rows.length, inputs: { url, method: query.http_method, parameters: paramValues }, outputs: { variableName: varName, rowCount: rows.length }, startedAt: stepStart, finishedAt: new Date().toISOString() });
            }

            // Follow edges
            const nextEdges = adjacency.get(nodeId) || [];
            for (const edge of nextEdges) {
              await executeNode(edge.target);
            }
          } catch (err) {
            stepResults.push({ nodeId, name: stepName, type: "query", status: "error", error: err instanceof Error ? err.message : String(err), startedAt: stepStart, finishedAt: new Date().toISOString() });
            throw err;
          }
        } else if (node.type === "condition" && config) {
          const conditions = (config.conditions || []) as Array<{ leftOperand: string; operator: string; rightOperand: string; dataType: string }>;
          const logicMode = (config.logicMode as string) || "all";

          const resolveOperand = (operand: string): unknown => {
            // Replace {{varName}} or {{varName.path}} with context values
            const match = operand.match(/^\{\{(.+?)\}\}$/);
            if (match) {
              const fullPath = match[1];
              // Check input variables first (direct name match like {{TRIP_NUMBER}})
              if (fullPath in inputVariables) {
                return inputVariables[fullPath];
              }
              const path = fullPath.split(".");
              let val: unknown = context;
              for (const p of path) {
                if (val && typeof val === "object") {
                  val = (val as Record<string, unknown>)[p];
                } else {
                  return undefined;
                }
              }
              return val;
            }
            // Substitute inline {{varName}} references within a larger string
            const inlineResolved = operand.replace(/\{\{(.+?)\}\}/g, (_m, key) => {
              if (key in inputVariables) return inputVariables[key];
              const path = key.split(".");
              let val: unknown = context;
              for (const p of path) {
                if (val && typeof val === "object") {
                  val = (val as Record<string, unknown>)[p];
                } else return "";
              }
              return val !== undefined && val !== null ? String(val) : "";
            });
            if (inlineResolved !== operand) return inlineResolved;
            return operand;
          };

          const evaluateCondition = (cond: { leftOperand: string; operator: string; rightOperand: string; dataType: string }): boolean => {
            const left = resolveOperand(cond.leftOperand);
            const right = resolveOperand(cond.rightOperand);

            switch (cond.operator) {
              case "equals": return String(left) === String(right);
              case "not_equals": return String(left) !== String(right);
              case "contains": return String(left).includes(String(right));
              case "not_contains": return !String(left).includes(String(right));
              case "greater_than": return Number(left) > Number(right);
              case "less_than": return Number(left) < Number(right);
              case "greater_or_equal": return Number(left) >= Number(right);
              case "less_or_equal": return Number(left) <= Number(right);
              case "starts_with": return String(left).startsWith(String(right));
              case "ends_with": return String(left).endsWith(String(right));
              case "is_empty": return left === null || left === undefined || left === "" || (Array.isArray(left) && left.length === 0);
              case "is_not_empty": return left !== null && left !== undefined && left !== "" && !(Array.isArray(left) && left.length === 0);
              case "is_true": return left === true || left === "true" || left === 1;
              case "is_false": return left === false || left === "false" || left === 0;
              default: return false;
            }
          };

          let result: boolean;
          if (conditions.length === 0) {
            result = false;
          } else if (logicMode === "all") {
            result = conditions.every(evaluateCondition);
          } else {
            result = conditions.some(evaluateCondition);
          }

          const branch = result ? "yes" : "no";
          stepResults.push({ nodeId, name: stepName, type: "condition", status: "success", branch, inputs: { conditions: conditions.map(c => ({ left: c.leftOperand, operator: c.operator, right: c.rightOperand })), logicMode }, outputs: { result: branch }, startedAt: stepStart, finishedAt: new Date().toISOString() });

          // Follow only the matching branch edge
          const nextEdges = adjacency.get(nodeId) || [];
          for (const edge of nextEdges) {
            if (edge.sourceHandle === branch) {
              await executeNode(edge.target);
            }
          }
        } else if (node.type === "action" && config) {
          try {
            const queryId = config.queryId as string;
            if (!queryId) throw new Error("Action step has no action configured");

            const { data: actionQuery, error: aqErr } = await admin
              .from("queries")
              .select("*, api_endpoints(*)")
              .eq("id", queryId)
              .maybeSingle();
            if (aqErr || !actionQuery) throw new Error(aqErr?.message || "Action query not found");
            const actionEndpoint = actionQuery.api_endpoints as Record<string, unknown> | null;
            if (!actionEndpoint) throw new Error("Action has no API endpoint");

            const paramMappings = (config.parameterMappings || []) as Array<{
              paramName: string;
              source: string;
              sourceValue: string;
              sourceNodeId?: string;
            }>;

            const actionParamValues: Record<string, string> = {};
            for (const mapping of paramMappings) {
              const paramKey = mapping.paramName.startsWith("@") ? mapping.paramName : `@${mapping.paramName}`;
              switch (mapping.source) {
                case "hardcoded":
                  actionParamValues[paramKey] = mapping.sourceValue || "";
                  break;
                case "input_variable":
                  actionParamValues[paramKey] = inputVariables[mapping.sourceValue] || "";
                  break;
                case "query_column":
                case "query_field": {
                  const [varName, colName] = (mapping.sourceValue || "").split("::");
                  const ctxData = context[varName];
                  if (ctxData) {
                    const rows = flattenRows(ctxData);
                    if (rows.length > 0 && colName) {
                      actionParamValues[paramKey] = String(rows[0][colName] ?? "");
                    } else {
                      actionParamValues[paramKey] = "";
                    }
                  } else {
                    actionParamValues[paramKey] = "";
                  }
                  break;
                }
                case "fixed_value": {
                  if (mapping.sourceValue) {
                    const { data: fv } = await admin
                      .from("fixed_values")
                      .select("value, resolved_value")
                      .eq("id", mapping.sourceValue)
                      .maybeSingle();
                    actionParamValues[paramKey] = fv?.resolved_value || fv?.value || "";
                  } else {
                    actionParamValues[paramKey] = "";
                  }
                  break;
                }
                case "date_function": {
                  if (mapping.sourceValue && mapping.sourceValue.startsWith(DATE_FUNCTION_PREFIX)) {
                    const fnId = mapping.sourceValue.slice(DATE_FUNCTION_PREFIX.length);
                    const { data: fn } = await admin
                      .from("date_functions")
                      .select("base_date, string_format, adjust_years, adjust_months, adjust_days")
                      .eq("id", fnId)
                      .maybeSingle();
                    if (fn) {
                      actionParamValues[paramKey] = computeDateFunctionValue(
                        fn.base_date as string,
                        fn.string_format as string,
                        fn.adjust_years as number,
                        fn.adjust_months as number,
                        fn.adjust_days as number
                      );
                    } else {
                      actionParamValues[paramKey] = "";
                    }
                  } else {
                    actionParamValues[paramKey] = mapping.sourceValue || "";
                  }
                  break;
                }
                default:
                  actionParamValues[paramKey] = mapping.sourceValue || "";
              }
            }

            if (Object.keys(inputVariables).length > 0) {
              for (const [key, val] of Object.entries(actionParamValues)) {
                actionParamValues[key] = val.replace(/\{\{(.+?)\}\}/g, (_m, varName) => {
                  if (varName in inputVariables) return inputVariables[varName];
                  return _m;
                });
              }
            }

            const actionUrl = buildQueryUrl(
              actionEndpoint.url as string,
              actionQuery.api_sub_path || "",
              (actionQuery.query_parameters || []) as QueryParameter[],
              actionQuery.url_query_string || "",
              actionParamValues,
              (actionQuery.path_variable_config || {}) as Record<string, string>
            );
            const actionHeaders = buildAuthHeaders(actionEndpoint);
            const actionFetchOptions: RequestInit = { method: actionQuery.http_method, headers: actionHeaders };
            if (["POST", "PUT", "PATCH"].includes(actionQuery.http_method)) {
              if (actionQuery.request_body_template) {
                try {
                  const body = JSON.parse(actionQuery.request_body_template);
                  const mappings = (actionQuery.request_body_field_mappings || []) as Array<{ fieldName: string; value: string; type: string; dataType: string }>;
                  mappings.forEach((m) => {
                    let resolvedValue = m.value;
                    if (m.type === "parameter" && m.value) {
                      resolvedValue = actionParamValues[m.value] || "";
                    } else if (m.type === "hardcoded") {
                      resolvedValue = substituteParams(resolvedValue, actionParamValues);
                    }
                    if (Object.keys(inputVariables).length > 0) {
                      resolvedValue = resolvedValue.replace(/\{\{(.+?)\}\}/g, (_match, vName) => {
                        if (vName in inputVariables) return inputVariables[vName];
                        return _match;
                      });
                    }
                    setNestedValue(body, m.fieldName, convertFieldValue(resolvedValue, m.dataType));
                  });
                  actionFetchOptions.body = JSON.stringify(body);
                } catch { /* fall through */ }
              }
              if (!actionFetchOptions.body && actionQuery.json_parameters && Object.keys(actionQuery.json_parameters).length) {
                actionFetchOptions.body = substituteParams(JSON.stringify(actionQuery.json_parameters), actionParamValues);
              }
              if (!actionFetchOptions.body && (actionEndpoint.endpoint_type === "nodal_connect" || actionQuery.nodal_db_connection_id)) {
                const inputs: Record<string, string> = {};
                Object.entries(actionParamValues).forEach(([key, val]) => {
                  inputs[key.replace(/^@/, "")] = val;
                });
                actionFetchOptions.body = JSON.stringify({ name: actionQuery.name, inputs });
              }
            }

            console.log(`[pulse-runner] Action step "${stepName}": ${actionQuery.http_method} ${actionUrl}`);
            const actionRes = await fetch(actionUrl, actionFetchOptions);
            const actionText = await actionRes.text();

            if (!actionRes.ok) {
              const onError = config.onError || "stop";
              stepResults.push({
                nodeId, name: stepName, type: "action", status: "error",
                error: `HTTP ${actionRes.status}: ${actionText.slice(0, 300)}`,
                inputs: { url: actionUrl, method: actionQuery.http_method, parameters: actionParamValues },
                startedAt: stepStart, finishedAt: new Date().toISOString(),
              });
              if (onError === "stop") throw new Error(`Action failed (${actionRes.status}): ${actionText.slice(0, 300)}`);
            } else {
              let responsePreview: unknown;
              try { responsePreview = JSON.parse(actionText); } catch { responsePreview = actionText.slice(0, 200); }
              stepResults.push({
                nodeId, name: stepName, type: "action", status: "success",
                inputs: { url: actionUrl, method: actionQuery.http_method, parameters: actionParamValues },
                outputs: { statusCode: actionRes.status, responsePreview: typeof responsePreview === "object" ? JSON.stringify(responsePreview).slice(0, 200) : responsePreview },
                startedAt: stepStart, finishedAt: new Date().toISOString(),
              });
            }

            const nextEdges = adjacency.get(nodeId) || [];
            for (const edge of nextEdges) {
              await executeNode(edge.target);
            }
          } catch (err) {
            const existingResult = stepResults.find(s => s.nodeId === nodeId);
            if (!existingResult) {
              stepResults.push({ nodeId, name: stepName, type: "action", status: "error", error: err instanceof Error ? err.message : String(err), startedAt: stepStart, finishedAt: new Date().toISOString() });
            }
            throw err;
          }
        } else if (node.type === "email" && config) {
          try {
            const toRecipients = (config.toRecipients || []) as string[];
            const ccRecipients = (config.ccRecipients || []) as string[];
            const bccRecipients = (config.bccRecipients || []) as string[];
            const subject = config.subject as string || pulse.name;
            const bodyTemplate = config.body as string || "";
            const bodyType = config.bodyType as string || "plain";
            const dataSourceVar = config.dataSource as string || "";
            const onlySendIfResults = config.onlySendIfResults as boolean ?? true;

            // Get data from context for attachment
            const sourceData = dataSourceVar ? context[dataSourceVar] : null;
            const rows = sourceData ? flattenRows(sourceData) : [];

            // Resolve {{column}} tokens in recipient lists
            const resolveRecipientTokens = (recipients: string[]): string[] => {
              const resolved: string[] = [];
              for (const entry of recipients) {
                const match = entry.trim().match(/^\{\{(.+)\}\}$/);
                if (match && rows.length > 0) {
                  const colName = match[1];
                  for (const row of rows) {
                    const val = row[colName];
                    if (typeof val === "string" && val.includes("@") && !resolved.includes(val)) {
                      resolved.push(val);
                    }
                  }
                } else if (!entry.trim().match(/^\{\{.+\}\}$/)) {
                  if (!resolved.includes(entry)) resolved.push(entry);
                }
              }
              return resolved;
            };

            const resolvedTo = resolveRecipientTokens(toRecipients);
            const resolvedCc = resolveRecipientTokens(ccRecipients);
            const resolvedBcc = resolveRecipientTokens(bccRecipients);

            if (onlySendIfResults && dataSourceVar && rows.length === 0) {
              stepResults.push({ nodeId, name: stepName, type: "email", status: "skipped", reason: "no_results", inputs: { to: resolvedTo, subject, dataSource: dataSourceVar }, startedAt: stepStart, finishedAt: new Date().toISOString() });
            } else {
              // Get email provider
              const { data: emailProviders } = await admin
                .from("email_configurations")
                .select("*")
                .eq("company_id", pulse.company_id)
                .eq("is_configured", true)
                .order("is_default", { ascending: false });
              const provider = (emailProviders || [])[0] ?? null;
              if (!provider) throw new Error("No email provider configured");

              const creds = provider.credentials as Record<string, string>;
              let emailToken: string;
              if (provider.provider === "gmail") {
                emailToken = await getGmailToken({ client_id: creds.client_id, client_secret: creds.client_secret, refresh_token: creds.refresh_token });
              } else {
                emailToken = await getO365Token({ tenant_id: creds.tenant_id, client_id: creds.client_id, client_secret: creds.client_secret });
              }

              const today = new Date().toISOString().slice(0, 10);
              const ctx = { pulseName: pulse.name, date: today, group: "all", rowCount: rows.length, resultsTable: "" };

              // Build results table if body contains {results_table}
              if (bodyTemplate.includes("{results_table}") && rows.length > 0) {
                const tableColumns = (config.resultsTableColumns || null) as string[] | null;
                const tableAliases = (config.columnAliases || config.columnMapping || null) as Record<string, string> | null;
                const tableFormats = (config.columnFormats || null) as Record<string, string> | null;
                const tableHeaderRow = (config.includeHeaderRow as boolean | undefined) !== false;
                ctx.resultsTable = buildHtmlTable(rows, tableColumns, tableAliases, tableHeaderRow, tableFormats);
              }

              const resolvedSubject = resolveTokens(subject, ctx);
              const resolvedBody = resolveTokens(bodyTemplate, ctx);

              // Substitute {{varName}} from input variables in subject/body
              const substituteInputVars = (text: string): string => {
                if (Object.keys(inputVariables).length === 0) return text;
                return text.replace(/\{\{(.+?)\}\}/g, (_m, varName) => {
                  if (varName in inputVariables) return inputVariables[varName];
                  return _m;
                });
              };
              const finalSubject = substituteInputVars(resolvedSubject);
              const finalBody = substituteInputVars(resolvedBody);

              // Build attachment if configured
              let attachment: SendEmailArgs["attachment"] | undefined;
              if (config.includeAttachment && rows.length > 0) {
                const fmt = (config.attachmentFormat as string) || "csv";
                const filename = (config.attachmentFilename as string) || `${pulse.name}_${today}.${fmt}`;
                if (fmt === "xlsx") {
                  const bytes = buildXlsxBytes(rows, true);
                  attachment = { name: filename, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: toBase64(bytes) };
                } else {
                  const csvStr = buildCsv(rows, true);
                  const bytes = new TextEncoder().encode(csvStr);
                  attachment = { name: filename, contentType: "text/csv", base64: toBase64(bytes) };
                }
              }

              const useHtml = bodyType === "html" || bodyTemplate.includes("{results_table}");
              const sendArgs: SendEmailArgs = {
                fromEmail: provider.send_from_email,
                token: emailToken,
                to: resolvedTo,
                cc: resolvedCc,
                bcc: resolvedBcc,
                subject: finalSubject,
                body: useHtml && bodyType !== "html" ? finalBody.replace(/\n/g, "<br>") : finalBody,
                isHtml: useHtml,
                attachment,
              };

              if (provider.provider === "gmail") {
                await sendGmailEmail(sendArgs);
              } else {
                await sendO365Email(sendArgs);
              }

              stepResults.push({ nodeId, name: stepName, type: "email", status: "success", recipientCount: resolvedTo.length + resolvedCc.length + resolvedBcc.length, inputs: { to: resolvedTo, cc: resolvedCc, bcc: resolvedBcc, subject: finalSubject, dataSource: dataSourceVar }, outputs: { recipientCount: resolvedTo.length + resolvedCc.length + resolvedBcc.length, hasAttachment: !!attachment }, startedAt: stepStart, finishedAt: new Date().toISOString() });
            }

            // Follow edges
            const nextEdges = adjacency.get(nodeId) || [];
            for (const edge of nextEdges) {
              await executeNode(edge.target);
            }
          } catch (err) {
            stepResults.push({ nodeId, name: stepName, type: "email", status: "error", error: err instanceof Error ? err.message : String(err), inputs: { to: (config.toRecipients || []) as string[], subject: (config.subject as string) || pulse.name }, startedAt: stepStart, finishedAt: new Date().toISOString() });
            throw err;
          }
        }
      };

      // Start execution from trigger node
      await executeNode(triggerNode.id);

      const hasErrors = stepResults.some(s => s.status === "error");
      const finalStatus = hasErrors ? "partial" : "success";

      if (executionId) {
        await admin
          .from("pulse_executions")
          .update({
            status: finalStatus,
            finished_at: new Date().toISOString(),
            row_count: 0,
            result_summary: {
              workflow_version: 2,
              step_results: stepResults,
              ...(Object.keys(inputVariables).length > 0 ? { input_variables: inputVariables, triggered_by: effectiveTriggerSource } : {}),
            },
          })
          .eq("id", executionId);
      }

      await admin
        .from("pulses")
        .update({ last_run_at: new Date().toISOString(), last_run_status: finalStatus })
        .eq("id", pulseId);

      return new Response(
        JSON.stringify({ success: true, executionId, status: finalStatus, stepResults }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // --- END V2 WORKFLOW ---

    // --- V1 LEGACY EXECUTION (existing behavior) ---
    console.log("[pulse-runner] Taking V1 LEGACY path");
    if (!pulse.query_id) throw new Error("Pulse has no query configured");

    const { data: query, error: qErr } = await admin
      .from("queries")
      .select("*, api_endpoints(*)")
      .eq("id", pulse.query_id)
      .maybeSingle();
    if (qErr || !query) throw new Error(qErr?.message || "Query not found");
    const endpoint = query.api_endpoints as Record<string, unknown> | null;
    if (!endpoint) throw new Error("Query has no API endpoint");

    const rawParamValues = (pulse.parameter_values || {}) as Record<string, string>;

    // Resolve date function references (fn::uuid -> computed date value)
    const fnRefs = Object.entries(rawParamValues).filter(([, v]) => v.startsWith(DATE_FUNCTION_PREFIX));
    let paramValues = rawParamValues;
    if (fnRefs.length > 0) {
      const fnIds = fnRefs.map(([, v]) => v.slice(DATE_FUNCTION_PREFIX.length));
      const { data: fns } = await admin
        .from("date_functions")
        .select("id, base_date, string_format, adjust_years, adjust_months, adjust_days")
        .in("id", fnIds);
      const fnMap = new Map((fns || []).map((f: Record<string, unknown>) => [f.id as string, f]));
      const resolved: Record<string, string> = { ...rawParamValues };
      fnRefs.forEach(([key, val]) => {
        const fnId = val.slice(DATE_FUNCTION_PREFIX.length);
        const fn = fnMap.get(fnId);
        if (fn) {
          resolved[key] = computeDateFunctionValue(
            fn.base_date as string,
            fn.string_format as string,
            fn.adjust_years as number,
            fn.adjust_months as number,
            fn.adjust_days as number
          );
        } else {
          resolved[key] = "";
        }
      });
      paramValues = resolved;
    }
    console.log("[pulse-runner] Parameter values:", JSON.stringify(paramValues));
    const url = buildQueryUrl(
      endpoint.url as string,
      query.api_sub_path || "",
      (query.query_parameters || []) as QueryParameter[],
      query.url_query_string || "",
      paramValues,
      (query.path_variable_config || {}) as Record<string, string>
    );
    console.log("[pulse-runner] HTTP method:", query.http_method);
    const headers = buildAuthHeaders(endpoint);
    const fetchOptions: RequestInit = { method: query.http_method, headers };
    if (["POST", "PUT", "PATCH"].includes(query.http_method)) {
      if (query.request_body_template) {
        try {
          const body = JSON.parse(query.request_body_template);
          const mappings = (query.request_body_field_mappings || []) as Array<{
            fieldName: string;
            value: string;
            type: string;
            dataType: string;
          }>;
          mappings.forEach((mapping) => {
            let resolvedValue = mapping.value;
            if (mapping.type === "parameter" && mapping.value) {
              resolvedValue = paramValues[mapping.value] || "";
            } else if (mapping.type === "hardcoded") {
              resolvedValue = substituteParams(resolvedValue, paramValues);
            }
            const typedValue = convertFieldValue(resolvedValue, mapping.dataType);
            setNestedValue(body, mapping.fieldName, typedValue);
          });
          fetchOptions.body = JSON.stringify(body);
        } catch {
          // fall through to json_parameters
        }
      }
      if (
        !fetchOptions.body &&
        query.json_parameters &&
        Object.keys(query.json_parameters).length
      ) {
        const bodyStr = substituteParams(JSON.stringify(query.json_parameters), paramValues);
        fetchOptions.body = bodyStr;
      }
      if (!fetchOptions.body && (endpoint.endpoint_type === "nodal_connect" || query.nodal_db_connection_id)) {
        const inputs: Record<string, string> = {};
        Object.entries(paramValues).forEach(([key, val]) => {
          inputs[key.replace(/^@/, "")] = val;
        });
        fetchOptions.body = JSON.stringify({ name: query.name, inputs });
      }
    }

    const apiRes = await fetch(url, fetchOptions);
    const apiText = await apiRes.text();
    console.log("[pulse-runner] API response status:", apiRes.status);
    console.log("[pulse-runner] API response length:", apiText.length);
    console.log("[pulse-runner] API response first 500 chars:", apiText.slice(0, 500));
    if (!apiRes.ok) throw new Error(`Query failed ${apiRes.status}: ${apiText.slice(0, 500)}`);
    let apiData: unknown;
    try { apiData = JSON.parse(apiText); } catch { apiData = { rawResponse: apiText }; }

    if (apiData && typeof apiData === "object" && !Array.isArray(apiData)) {
      const keys = Object.keys(apiData as Record<string, unknown>);
      console.log("[pulse-runner] Response top-level keys:", keys);
      for (const key of keys) {
        const val = (apiData as Record<string, unknown>)[key];
        console.log(`[pulse-runner] Key "${key}": type=${typeof val}, isArray=${Array.isArray(val)}, length=${Array.isArray(val) ? val.length : 'N/A'}`);
      }
    }

    const allRows = flattenRows(apiData);
    console.log("[pulse-runner] flattenRows returned:", allRows.length, "rows");
    if (allRows.length > 0) {
      console.log("[pulse-runner] First row keys:", Object.keys(allRows[0]));
    }

    const { data: exportCfg } = await admin
      .from("pulse_exports")
      .select("*")
      .eq("pulse_id", pulseId)
      .maybeSingle();
    const { data: emailCfg } = await admin
      .from("pulse_emails")
      .select("*")
      .eq("pulse_id", pulseId)
      .maybeSingle();
    console.log("[pulse-runner] emailCfg:", JSON.stringify(emailCfg ? { enabled: emailCfg.enabled, only_send_if_results: emailCfg.only_send_if_results, include_results_table: emailCfg.include_results_table, body_template: emailCfg.body_template } : null));
    const { data: o365Rows } = await admin
      .from("email_configurations")
      .select("*")
      .eq("company_id", pulse.company_id)
      .eq("is_configured", true)
      .order("is_default", { ascending: false });
    const emailProvider = (o365Rows || [])[0] ?? null;
    console.log("[pulse-runner] emailProvider:", emailProvider ? emailProvider.provider : "NONE");
    console.log("[pulse-runner] emailProvider configured:", !!emailProvider);

    const today = new Date().toISOString().slice(0, 10);

    // Derive runMode from step_configs (query node) or fall back to pulse-level field
    let runMode = pulse.run_mode || "result_set";
    let groupByField = pulse.group_by_field;
    if (pulse.step_configs) {
      const configs = pulse.step_configs as Record<string, { stepType: string; runMode?: string; groupByField?: string | null }>;
      const qCfg = Object.values(configs).find(c => c.stepType === "query");
      if (qCfg?.runMode) {
        runMode = qCfg.runMode;
        groupByField = qCfg.groupByField ?? groupByField;
      }
    }

    type Iter = { groupValue: string; rows: Record<string, unknown>[] };
    let iterations: Iter[] = [];
    if (runMode === "per_row") {
      iterations = allRows.map((r, i) => ({
        groupValue: String((r as Record<string, unknown>)[groupByField || ""] ?? `row-${i + 1}`),
        rows: [r],
      }));
    } else if (runMode === "per_group") {
      const field = groupByField;
      if (!field) throw new Error("Per-group run mode requires group_by_field");
      const grouped = new Map<string, Record<string, unknown>[]>();
      for (const r of allRows) {
        const key = String((r as Record<string, unknown>)[field] ?? "(empty)");
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(r);
      }
      iterations = Array.from(grouped, ([groupValue, rows]) => ({ groupValue, rows }));
    } else {
      iterations = [{ groupValue: "all", rows: allRows }];
    }

    const summary: Array<Record<string, unknown>> = [];
    let emailsSent = 0;
    let exportsCreated = 0;
    let firstExportPath: string | null = null;
    let token: string | null = null;
    console.log("[pulse-runner] runMode:", runMode, "iterations:", iterations.length);
    console.log("[pulse-runner] emailCfg?.enabled:", emailCfg?.enabled, "emailProvider:", !!emailProvider);
    if (emailCfg?.enabled && emailProvider) {
      try {
        const creds = emailProvider.credentials as Record<string, string>;
        console.log("[pulse-runner] Getting token for provider:", emailProvider.provider);
        if (emailProvider.provider === "gmail") {
          token = await getGmailToken({
            client_id: creds.client_id,
            client_secret: creds.client_secret,
            refresh_token: creds.refresh_token,
          });
        } else {
          token = await getO365Token({
            tenant_id: creds.tenant_id,
            client_id: creds.client_id,
            client_secret: creds.client_secret,
          });
        }
        console.log("[pulse-runner] Got token:", !!token);
      } catch (err) {
        console.error("[pulse-runner] Token error:", err instanceof Error ? err.message : String(err));
        summary.push({ stage: "email_token", error: err instanceof Error ? err.message : String(err) });
      }
    }

    for (const iter of iterations) {
      const bodyHasTableToken = (emailCfg?.body_template || "").includes("{results_table}");
      const tableColumns = bodyHasTableToken
        ? ((emailCfg?.results_table_columns || []) as string[])
        : null;
      const tableAliases = (emailCfg?.column_aliases || {}) as Record<string, string>;
      const tableFormats = (emailCfg?.column_formats || {}) as Record<string, string>;
      const tableIncludeHeader = emailCfg?.include_header_row !== false;
      const resultsTable = bodyHasTableToken
        ? buildHtmlTable(iter.rows as Record<string, unknown>[], tableColumns, tableAliases, tableIncludeHeader, tableFormats)
        : "";
      const ctx = {
        pulseName: pulse.name,
        date: today,
        group: iter.groupValue,
        rowCount: iter.rows.length,
        resultsTable,
      };
      const filenameBase = resolveTokens(
        exportCfg?.filename_template || "{pulse_name}_{date}",
        ctx
      );
      const fmt = exportCfg?.format === "xlsx" ? "xlsx" : "csv";
      const filename = `${filenameBase}.${fmt}`;

      let attachmentBase64: string | null = null;
      let exportBytes: Uint8Array | null = null;
      if (exportCfg?.enabled) {
        try {
          if (fmt === "xlsx") {
            exportBytes = buildXlsxBytes(iter.rows, exportCfg.include_headers ?? true);
          } else {
            exportBytes = new TextEncoder().encode(buildCsv(iter.rows, exportCfg.include_headers ?? true));
          }
          attachmentBase64 = toBase64(exportBytes);
          exportsCreated++;

          if (executionId) {
            const safeName = filename.replace(/[^A-Za-z0-9_.\-]+/g, "_");
            const objectPath = `${pulseId}/${executionId}-${safeName}`;
            const contentType =
              fmt === "xlsx"
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "text/csv";
            const { error: uploadErr } = await admin.storage
              .from("pulse-exports")
              .upload(objectPath, exportBytes, { contentType, upsert: true });
            if (uploadErr) {
              summary.push({ stage: "export_upload", group: iter.groupValue, error: uploadErr.message });
            } else if (!firstExportPath) {
              firstExportPath = objectPath;
            }
          }
        } catch (err) {
          summary.push({ stage: "export", group: iter.groupValue, error: err instanceof Error ? err.message : String(err) });
        }
      }

      const shouldEmail =
        emailCfg?.enabled &&
        token &&
        emailProvider &&
        (iter.rows.length > 0 || emailCfg.only_send_if_results === false);

      console.log("[pulse-runner] shouldEmail check:", {
        emailEnabled: emailCfg?.enabled,
        hasToken: !!token,
        hasProvider: !!emailProvider,
        rowCount: iter.rows.length,
        onlyIfResults: emailCfg?.only_send_if_results,
        shouldEmail: !!shouldEmail,
      });

      if (shouldEmail) {
        try {
          const subject = resolveTokens(emailCfg!.subject_template || ctx.pulseName, ctx);
          const body = resolveTokens(emailCfg!.body_template || "", ctx);
          const useHtml = !!(bodyHasTableToken && resultsTable);
          console.log("[pulse-runner] Sending email:", { subject, useHtml, bodyLength: body.length, to: emailCfg!.to_recipients });
          const sendArgs: SendEmailArgs = {
            fromEmail: emailProvider!.send_from_email,
            token: token!,
            to: emailCfg!.to_recipients || [],
            cc: emailCfg!.cc_recipients || [],
            bcc: emailCfg!.bcc_recipients || [],
            subject,
            body: useHtml ? body.replace(/\n/g, "<br>") : body,
            isHtml: useHtml,
            attachment:
              attachmentBase64 && emailCfg!.attach_export
                ? {
                    name: filename,
                    contentType:
                      fmt === "xlsx"
                        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        : "text/csv",
                    base64: attachmentBase64,
                  }
                : undefined,
          };
          if (emailProvider!.provider === "gmail") {
            await sendGmailEmail(sendArgs);
          } else {
            await sendO365Email(sendArgs);
          }
          emailsSent++;
          console.log("[pulse-runner] Email sent successfully");
        } catch (err) {
          console.error("[pulse-runner] Email send error:", err instanceof Error ? err.message : String(err));
          summary.push({ stage: "email", group: iter.groupValue, error: err instanceof Error ? err.message : String(err) });
        }
      }

      summary.push({
        group: iter.groupValue,
        row_count: iter.rows.length,
      });
    }

    const finalStatus = summary.some((s) => "error" in s) ? "partial" : "success";

    const emailRecipients: string[] = [];
    if (emailsSent > 0 && emailCfg) {
      if (emailCfg.to_recipients) emailRecipients.push(...emailCfg.to_recipients);
      if (emailCfg.cc_recipients) emailRecipients.push(...emailCfg.cc_recipients);
      if (emailCfg.bcc_recipients) emailRecipients.push(...emailCfg.bcc_recipients);
    }

    if (executionId) {
      await admin
        .from("pulse_executions")
        .update({
          status: finalStatus,
          finished_at: new Date().toISOString(),
          row_count: allRows.length,
          export_path: firstExportPath,
          result_summary: {
            iterations: summary,
            emails_sent: emailsSent,
            exports_created: exportsCreated,
            run_mode: runMode,
            email_recipients: emailRecipients.length > 0 ? emailRecipients : undefined,
          },
        })
        .eq("id", executionId);
    }

    await admin
      .from("pulses")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: finalStatus,
      })
      .eq("id", pulseId);

    return new Response(
      JSON.stringify({
        success: true,
        executionId,
        status: finalStatus,
        rowCount: allRows.length,
        emailsSent,
        exportsCreated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[pulse-runner] FATAL ERROR:", message);
    if (err instanceof Error && err.stack) {
      console.error("[pulse-runner] Stack:", err.stack);
    }
    if (executionId) {
      await admin
        .from("pulse_executions")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", executionId);
    }
    if (pulseId) {
      await admin
        .from("pulses")
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: "error",
        })
        .eq("id", pulseId);
    }
    return new Response(
      JSON.stringify({ success: false, error: message, executionId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
