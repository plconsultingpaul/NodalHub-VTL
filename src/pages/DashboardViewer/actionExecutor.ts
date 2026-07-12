import { supabase } from '../../lib/supabase';
import { proxyFetch } from '../../lib/apiProxy';
import type {
  ApiEndpoint,
  UserParameter,
  RequestBodyFieldMapping,
  DashboardCellActionWithQuery,
  ActionParameterMapping,
  PulseVariableMapping,
} from '../../types/database';

const MULTI_ROW_DELAY_MS = 100;

export interface ActionExecutionResult {
  success: number;
  failed: number;
  pulseTriggered: number;
  errors: string[];
}

export interface ActionProgressCallback {
  (current: number, total: number): void;
}

function substituteUserParameters(value: string, params: Record<string, string>): string {
  let result = value;
  Object.entries(params).forEach(([name, val]) => {
    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, val);
  });
  return result;
}

function substitutePathParameters(path: string, userParams: UserParameter[], paramValues: Record<string, string>): string {
  let result = path;
  userParams
    .filter(p => p.target === 'path')
    .forEach(param => {
      const paramName = param.name.replace(/^@/, '');
      const value = paramValues[param.name] || '';
      const pathParamRegex = new RegExp(`\\{${paramName}\\}`, 'gi');
      result = result.replace(pathParamRegex, encodeURIComponent(value));
    });
  return result;
}

function buildRequestBody(
  template: string | null,
  fieldMappings: RequestBodyFieldMapping[],
  paramValues: Record<string, string>
): object | null {
  if (!template) return null;

  try {
    const body = JSON.parse(template);

    const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown) => {
      const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
      let current = obj;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        const isNextArray = /^\d+$/.test(nextPart);

        if (!(part in current)) {
          current[part] = isNextArray ? [] : {};
        }
        current = current[part] as Record<string, unknown>;
      }

      const lastPart = parts[parts.length - 1];
      current[lastPart] = value;
    };

    const convertValue = (value: string, dataType: string): unknown => {
      switch (dataType) {
        case 'integer':
          return parseInt(value, 10) || 0;
        case 'double':
          return parseFloat(value) || 0;
        case 'boolean':
          return value.toLowerCase() === 'true';
        case 'date':
          return value ? value.split('T')[0] : value;
        default:
          return value;
      }
    };

    fieldMappings.forEach(mapping => {
      let resolvedValue = mapping.value;

      if (mapping.type === 'parameter' && mapping.value) {
        resolvedValue = paramValues[mapping.value] || '';
      }

      const typedValue = convertValue(resolvedValue, mapping.dataType);
      setNestedValue(body, mapping.fieldName, typedValue);
    });

    return body;
  } catch {
    console.error('[actionExecutor] Failed to parse request body template:', template);
    return null;
  }
}

async function fetchEndpoint(endpointId: string): Promise<ApiEndpoint | null> {
  const { data } = await supabase
    .from('api_endpoints')
    .select('*')
    .eq('id', endpointId)
    .maybeSingle();
  return data as ApiEndpoint | null;
}

function buildParamValues(
  action: DashboardCellActionWithQuery,
  rowData: Record<string, unknown>,
  promptValues?: Record<string, string>
): Record<string, string> {
  const mappings = (action.parameter_mappings as unknown as ActionParameterMapping[]) || [];
  const paramValues: Record<string, string> = {};
  mappings.forEach(m => {
    if (m.target === 'hardcode') {
      paramValues[m.parameterName] = m.hardcodeValue || '';
    } else if (m.target === 'prompt' || m.target === 'lookup') {
      if (promptValues && promptValues[m.parameterName] !== undefined) {
        paramValues[m.parameterName] = promptValues[m.parameterName];
      }
    } else {
      if (m.columnName && rowData[m.columnName] !== undefined) {
        paramValues[m.parameterName] = String(rowData[m.columnName]);
      }
    }
  });
  return paramValues;
}

function buildHeaders(ep: ApiEndpoint): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(ep.headers as Record<string, string> || {})
  };

  if (ep.auth_type === 'bearer') {
    const config = ep.auth_config as { token?: string };
    if (config?.token) headers['Authorization'] = `Bearer ${config.token}`;
  } else if (ep.auth_type === 'api_key') {
    const config = ep.auth_config as { header_name?: string; api_key?: string };
    if (config?.header_name && config?.api_key) headers[config.header_name] = config.api_key;
  } else if (ep.auth_type === 'basic') {
    const config = ep.auth_config as { username?: string; password?: string };
    if (config?.username && config?.password) headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
  }

  return headers;
}

export async function executeActionForRow(
  action: DashboardCellActionWithQuery,
  rowData: Record<string, unknown>,
  promptValues?: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const query = action.queries;
  if (!query || !query.api_endpoint_id) return { ok: false, error: 'No query or endpoint configured' };

  const paramValues = buildParamValues(action, rowData, promptValues);

  try {
    const ep = await fetchEndpoint(query.api_endpoint_id);
    if (!ep) return { ok: false, error: 'API endpoint not found' };

    const userParams = (query.user_parameters as unknown as UserParameter[]) || [];
    const pathVarConfig = (query.path_variable_config as Record<string, string>) || {};
    const baseUrl = ep.url.replace(/\/$/, '');
    let substitutedSubPath = substitutePathParameters(query.api_sub_path, userParams, paramValues);

    // Apply path variable mappings from cell action config (isPathVariable mappings)
    const pathVarMappings = (action.parameter_mappings as unknown as ActionParameterMapping[]) || [];
    pathVarMappings
      .filter(m => m.isPathVariable)
      .forEach(m => {
        const varName = m.parameterName.replace(/^\{|\}$/g, '');
        let value = '';
        if (m.target === 'column' && m.columnName) {
          value = String(rowData[m.columnName] ?? '');
        } else if (m.target === 'hardcode') {
          value = m.hardcodeValue || '';
        } else if (m.target === 'prompt' || m.target === 'lookup') {
          value = promptValues?.[m.parameterName] || '';
        }
        if (value) {
          const regex = new RegExp(`\\{${varName}\\}`, 'gi');
          substitutedSubPath = substitutedSubPath.replace(regex, encodeURIComponent(value));
        }
      });

    // Also apply stored path_variable_config values
    if (Object.keys(pathVarConfig).length > 0) {
      substitutedSubPath = substitutedSubPath.replace(/\{([^}]+)\}/g, (match, varName) => {
        const configValue = pathVarConfig[varName];
        if (configValue) {
          const dynamicMatch = configValue.match(/\{\{([^}]+)\}\}/);
          if (dynamicMatch) {
            const resolved = paramValues[`@${dynamicMatch[1]}`] || paramValues[dynamicMatch[1]] || '';
            return encodeURIComponent(resolved);
          }
          return encodeURIComponent(configValue);
        }
        return match;
      });
    }
    const normalizedSubPath = substitutedSubPath.replace(/^\//, '').replace(/\/$/, '');
    let url = normalizedSubPath ? `${baseUrl}/${normalizedSubPath}` : baseUrl;

    const queryParams = query.query_parameters as Array<{ key: string; value: string; enabled: boolean }> | null;
    const enabledParams = queryParams?.filter(p => p.enabled && p.value);

    let queryString = '';
    if (enabledParams && enabledParams.length > 0) {
      queryString = enabledParams
        .map(p => {
          const substitutedValue = substituteUserParameters(p.value, paramValues);
          return `${encodeURIComponent(p.key)}=${encodeURIComponent(substitutedValue)}`;
        })
        .join('&');
    } else if (query.url_query_string) {
      queryString = substituteUserParameters(query.url_query_string, paramValues);
    }

    if (queryString) url += `?${queryString}`;

    const headers = buildHeaders(ep);
    let body: string | undefined;

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(query.http_method)) {
      if (query.query_type === 'sql' || query.query_type === 'stored_procedure') {
        const inputs: Record<string, string> = {};
        Object.entries(paramValues).forEach(([key, val]) => {
          inputs[key.replace(/^@/, '')] = val;
        });
        body = JSON.stringify({ name: query.name, inputs });
      } else {
        const fieldMappings = (query.request_body_field_mappings as unknown as RequestBodyFieldMapping[]) || [];
        const requestBody = buildRequestBody(query.request_body_template, fieldMappings, paramValues);
        if (requestBody) {
          body = JSON.stringify(requestBody);
        }
      }
    }

    console.log('[actionExecutor] Executing:', {
      url,
      method: query.http_method,
      hasBody: !!body,
      bodyPreview: body ? body.slice(0, 500) : null,
      paramValues,
    });

    const response = await proxyFetch(url, {
      method: query.http_method,
      headers,
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[actionExecutor] Action failed:', { status: response.status, response: text.slice(0, 500), url });
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    console.log('[actionExecutor] Action succeeded:', { status: response.status, url });
    return { ok: true };
  } catch (err) {
    console.error('[actionExecutor] Execution error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function triggerPostActionPulse(
  action: DashboardCellActionWithQuery,
  rowData: Record<string, unknown>,
  promptValues?: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  if (!action.post_action_pulse_id) return { ok: false, error: 'No pulse configured' };

  const mappings = (action.pulse_variable_mappings as unknown as PulseVariableMapping[]) || [];
  const inputVariables: Record<string, string> = {};

  console.log('[actionExecutor] triggerPostActionPulse called:', {
    pulseId: action.post_action_pulse_id,
    mappingCount: mappings.length,
    mappings: JSON.stringify(mappings),
    promptValues: JSON.stringify(promptValues),
    rowDataKeys: Object.keys(rowData),
  });

  // Resolve current_user mappings from the session profile
  const hasCurrentUserMapping = mappings.some(m => m.source === 'current_user');
  let userProfile: { full_name?: string; email?: string; username?: string | null } | null = null;
  if (hasCurrentUserMapping) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, username')
        .eq('id', userId)
        .maybeSingle();
      userProfile = profile;
    }
  }

  for (const mapping of mappings) {
    if (mapping.source === 'column') {
      inputVariables[mapping.variableName] = String(rowData[mapping.sourceValue] ?? '');
    } else if (mapping.source === 'hardcode') {
      inputVariables[mapping.variableName] = mapping.sourceValue;
    } else if (mapping.source === 'prompt') {
      inputVariables[mapping.variableName] = promptValues?.[mapping.sourceValue] || '';
    } else if (mapping.source === 'current_user') {
      const field = mapping.sourceValue || 'full_name';
      if (userProfile) {
        inputVariables[mapping.variableName] = String((userProfile as Record<string, unknown>)[field] ?? '');
      } else {
        inputVariables[mapping.variableName] = '';
      }
    }
  }

  console.log('[actionExecutor] Resolved input_variables:', JSON.stringify(inputVariables));

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pulse-runner`;

    const requestBody = {
      pulseId: action.post_action_pulse_id,
      input_variables: inputVariables,
      triggered_by: 'cell_action',
    };
    console.log('[actionExecutor] Calling pulse-runner:', apiUrl);
    console.log('[actionExecutor] Request body:', JSON.stringify(requestBody));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('[actionExecutor] Pulse-runner response status:', response.status);
    console.log('[actionExecutor] Pulse-runner response body:', responseText);

    if (!response.ok) {
      return { ok: false, error: `Pulse trigger HTTP ${response.status}: ${responseText.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    console.error('[actionExecutor] Pulse trigger error:', err);
    return { ok: false, error: `Pulse trigger: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

export async function executeActionForRows(
  action: DashboardCellActionWithQuery,
  rows: Record<string, unknown>[],
  onProgress?: ActionProgressCallback,
  promptValues?: Record<string, string>
): Promise<ActionExecutionResult> {
  if (rows.length === 0) {
    return { success: 0, failed: 0, pulseTriggered: 0, errors: [] };
  }

  let success = 0;
  let failed = 0;
  let pulseTriggered = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    onProgress?.(i + 1, rows.length);
    const result = await executeActionForRow(action, rows[i], promptValues);
    if (result.ok) {
      success++;
      if (action.post_action_pulse_id) {
        const pulseResult = await triggerPostActionPulse(action, rows[i], promptValues);
        if (pulseResult.ok) {
          pulseTriggered++;
        } else if (pulseResult.error && !errors.includes(pulseResult.error)) {
          errors.push(pulseResult.error);
        }
      }
    } else {
      failed++;
      if (result.error && !errors.includes(result.error)) {
        errors.push(result.error);
      }
    }

    if (i < rows.length - 1) {
      await delay(MULTI_ROW_DELAY_MS);
    }
  }

  return { success, failed, pulseTriggered, errors };
}

export function getPromptMappings(action: DashboardCellActionWithQuery): ActionParameterMapping[] {
  const mappings = (action.parameter_mappings as unknown as ActionParameterMapping[]) || [];
  return mappings.filter(m => m.target === 'prompt' || m.target === 'lookup');
}

export function executeLinkAction(
  action: DashboardCellActionWithQuery,
  rowData: Record<string, unknown>,
  promptValues?: Record<string, string>
): void {
  const urlTemplate = action.link_url_template || '';
  if (!urlTemplate) return;

  const paramValues = buildParamValues(action, rowData, promptValues);

  let url = urlTemplate;
  Object.entries(paramValues).forEach(([name, value]) => {
    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    url = url.replace(regex, encodeURIComponent(value));
  });

  window.open(url, '_blank', 'noopener,noreferrer');
}
