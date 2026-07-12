const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ProxyFetchOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export async function proxyFetch(
  targetUrl: string,
  options: ProxyFetchOptions
): Promise<Response> {
  const proxyUrl = `${SUPABASE_URL}/functions/v1/api-proxy`;

  const proxyBody: {
    targetUrl: string;
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {
    targetUrl,
    method: options.method,
    headers: options.headers,
  };

  if (options.body) {
    try {
      proxyBody.body = JSON.parse(options.body);
    } catch {
      proxyBody.body = options.body;
    }
  }

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(proxyBody),
  });

  return response;
}
