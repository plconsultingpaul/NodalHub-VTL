import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProxyRequest {
  targetUrl: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  endpointId?: string;
}

async function getProxyUrl(endpointId: string): Promise<string | null> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: endpoint } = await supabase
    .from("api_endpoints")
    .select("use_proxy, company_id")
    .eq("id", endpointId)
    .maybeSingle();

  if (!endpoint?.use_proxy) return null;

  const { data: proxyConfig } = await supabase
    .from("proxy_configuration")
    .select("proxy_url, is_active")
    .eq("company_id", endpoint.company_id)
    .eq("is_active", true)
    .maybeSingle();

  return proxyConfig?.proxy_url || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { targetUrl, method, headers: customHeaders, body, endpointId }: ProxyRequest = await req.json();

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: "targetUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestHeaders: Record<string, string> = {
      ...customHeaders,
    };

    if (body && !requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "application/json";
    }

    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: requestHeaders,
    };

    if (body && ["POST", "PUT", "PATCH"].includes(method)) {
      fetchOptions.body = JSON.stringify(body);
      console.log(`[api-proxy] Request body sent to target:`, fetchOptions.body);
    }

    let proxyUrl: string | null = null;
    if (endpointId) {
      proxyUrl = await getProxyUrl(endpointId);
    }

    let response: Response;

    if (proxyUrl) {
      console.log(`[api-proxy] ${method} ${targetUrl} (via proxy)`);
      const httpClient = Deno.createHttpClient({
        proxy: { url: proxyUrl },
      });
      response = await fetch(targetUrl, { ...fetchOptions, client: httpClient } as RequestInit);
    } else {
      console.log(`[api-proxy] ${method} ${targetUrl}`);
      response = await fetch(targetUrl, fetchOptions);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => { responseHeaders[k] = v; });
      console.error(`[api-proxy] Error: ${response.status} - ${errorText}`);
      console.error(`[api-proxy] Response headers:`, JSON.stringify(responseHeaders));
      return new Response(
        JSON.stringify({
          error: `API request failed: ${response.status} ${response.statusText}`,
          details: errorText,
          responseHeaders
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { rawResponse: responseText };
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("[api-proxy] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
