import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { proxyFetch } from '../lib/apiProxy';
import type { FixedValue, ApiEndpoint, Query } from '../types/database';

export interface LookupOption {
  value: string;
  label: string;
}

interface LookupState {
  options: LookupOption[];
  loading: boolean;
  error: string | null;
}

function buildEndpointHeaders(endpoint: ApiEndpoint): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(endpoint.headers as Record<string, string> || {})
  };

  if (endpoint.auth_type === 'bearer') {
    const config = endpoint.auth_config as { token?: string };
    if (config?.token) headers['Authorization'] = `Bearer ${config.token}`;
  } else if (endpoint.auth_type === 'api_key') {
    const config = endpoint.auth_config as { header_name?: string; api_key?: string };
    if (config?.header_name && config?.api_key) headers[config.header_name] = config.api_key;
  } else if (endpoint.auth_type === 'basic') {
    const config = endpoint.auth_config as { username?: string; password?: string };
    if (config?.username && config?.password) {
      headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
    }
  }

  return headers;
}

function extractRows(responseData: unknown): unknown[] {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    const data = responseData as Record<string, unknown>;

    // Nodal Connect format: { result: { rows: [...] } }
    if (data.result && typeof data.result === 'object') {
      const result = data.result as Record<string, unknown>;
      if (Array.isArray(result.rows)) {
        return result.rows as unknown[];
      }
    }

    // Direct rows property
    if (Array.isArray(data.rows)) {
      return data.rows as unknown[];
    }

    // Common API response patterns
    const possibleArrayKeys = ['value', 'data', 'results', 'items', 'records'];
    for (const k of possibleArrayKeys) {
      if (Array.isArray(data[k])) {
        return data[k] as unknown[];
      }
    }

    // Fallback: first array property found
    const firstArrayProp = Object.values(data).find(v => Array.isArray(v));
    if (firstArrayProp) return firstArrayProp as unknown[];
  }

  return [];
}

export function useLookupResolver() {
  const [lookupData, setLookupData] = useState<Record<string, LookupState>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  const resolveLookup = useCallback(async (fixedValue: FixedValue) => {
    console.log('[LookupResolver] resolveLookup called for:', fixedValue.name, 'type:', fixedValue.value_type, 'queryId:', fixedValue.lookup_query_id);

    if (fixedValue.value_type !== 'lookup' || !fixedValue.lookup_query_id) {
      console.log('[LookupResolver] Skipping - not a lookup type or no query ID');
      return;
    }

    const key = fixedValue.id;
    if (fetchedRef.current.has(key)) {
      console.log('[LookupResolver] Already fetched, skipping:', key);
      return;
    }
    fetchedRef.current.add(key);

    setLookupData(prev => ({
      ...prev,
      [key]: { options: [], loading: true, error: null }
    }));

    try {
      const { data: query, error: queryError } = await supabase
        .from('queries')
        .select(`*, api_endpoints (id, name, url, auth_type, auth_config, headers)`)
        .eq('id', fixedValue.lookup_query_id)
        .maybeSingle();

      if (queryError || !query) {
        const errMsg = queryError?.message || 'Lookup query not found';
        console.error('[LookupResolver] Query fetch failed:', errMsg);
        setLookupData(prev => ({
          ...prev,
          [key]: { options: [], loading: false, error: errMsg }
        }));
        return;
      }

      console.log('[LookupResolver] Query loaded:', query.name, 'type:', query.query_type, 'method:', query.http_method, 'subPath:', query.api_sub_path);

      const endpoint = query.api_endpoints as ApiEndpoint | null;
      if (!endpoint) {
        console.error('[LookupResolver] No endpoint on query');
        setLookupData(prev => ({
          ...prev,
          [key]: { options: [], loading: false, error: 'No endpoint configured on lookup query' }
        }));
        return;
      }

      console.log('[LookupResolver] Endpoint:', endpoint.name, endpoint.url);

      const headers = buildEndpointHeaders(endpoint);
      const isNodalConnect = query.query_type === 'sql' || query.query_type === 'stored_procedure';

      let url: string;
      let fetchOptions: RequestInit;

      if (isNodalConnect) {
        // Nodal Connect queries use POST to /executables/run with { name, inputs }
        url = `${endpoint.url.replace(/\/$/, '')}/executables/run`;
        const requestBody = { name: query.name, inputs: {} };
        fetchOptions = {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        };
        console.log('[LookupResolver] Nodal Connect mode - URL:', url, 'body:', JSON.stringify(requestBody));
      } else {
        // Standard API endpoint query
        url = endpoint.url.replace(/\/$/, '');
        const subPath = (query.api_sub_path || '').replace(/^\//, '').replace(/\/$/, '');
        if (subPath) {
          url = `${url}/${subPath}`;
        }

        const queryParams = query.query_parameters as Array<{ key: string; value: string; enabled: boolean }> | null;
        const enabledParams = queryParams?.filter(p => p.enabled && p.value);
        if (query.url_query_string) {
          url += `?${query.url_query_string}`;
        } else if (enabledParams && enabledParams.length > 0) {
          const paramString = enabledParams
            .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
            .join('&');
          url += `?${paramString}`;
        }

        fetchOptions = { method: query.http_method || 'GET', headers };
        console.log('[LookupResolver] API endpoint mode - URL:', url, 'method:', query.http_method);
      }

      const response = await proxyFetch(url, fetchOptions);
      const responseData = await response.json();

      console.log('[LookupResolver] Response status:', response.status, 'data keys:', responseData ? Object.keys(responseData) : 'null');

      const items = extractRows(responseData);
      console.log('[LookupResolver] Extracted', items.length, 'rows. First row:', items.length > 0 ? JSON.stringify(items[0]) : 'N/A');

      const valueField = fixedValue.lookup_value_field || 'id';
      const labelField = fixedValue.lookup_label_field || 'name';
      console.log('[LookupResolver] Mapping fields - value:', valueField, 'label:', labelField);

      const options: LookupOption[] = items.map((item: unknown) => {
        const record = item as Record<string, unknown>;
        const val = String(record[valueField] ?? '');
        const lbl = String(record[labelField] ?? val);
        return { value: val, label: lbl };
      });

      console.log('[LookupResolver] Resolved', options.length, 'options. First:', options.length > 0 ? JSON.stringify(options[0]) : 'N/A');

      setLookupData(prev => ({
        ...prev,
        [key]: { options, loading: false, error: null }
      }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Lookup failed';
      console.error('[LookupResolver] Error:', errMsg, err);
      setLookupData(prev => ({
        ...prev,
        [key]: { options: [], loading: false, error: errMsg }
      }));
    }
  }, []);

  const resolveLookupByQueryId = useCallback(async (queryId: string) => {
    console.log('[LookupResolver] resolveLookupByQueryId called for queryId:', queryId);

    if (!queryId) return;

    const key = `query_${queryId}`;
    if (fetchedRef.current.has(key)) {
      console.log('[LookupResolver] Already fetched, skipping:', key);
      return;
    }
    fetchedRef.current.add(key);

    setLookupData(prev => ({
      ...prev,
      [key]: { options: [], loading: true, error: null }
    }));

    try {
      const { data: query, error: queryError } = await supabase
        .from('queries')
        .select(`*, api_endpoints (id, name, url, auth_type, auth_config, headers)`)
        .eq('id', queryId)
        .maybeSingle();

      if (queryError || !query) {
        const errMsg = queryError?.message || 'Lookup query not found';
        console.error('[LookupResolver] Query fetch failed:', errMsg);
        setLookupData(prev => ({
          ...prev,
          [key]: { options: [], loading: false, error: errMsg }
        }));
        return;
      }

      console.log('[LookupResolver] Query loaded:', query.name, 'type:', query.query_type);

      const endpoint = query.api_endpoints as ApiEndpoint | null;
      if (!endpoint) {
        setLookupData(prev => ({
          ...prev,
          [key]: { options: [], loading: false, error: 'No endpoint configured on lookup query' }
        }));
        return;
      }

      const headers = buildEndpointHeaders(endpoint);
      const isNodalConnect = query.query_type === 'sql' || query.query_type === 'stored_procedure';

      let url: string;
      let fetchOptions: RequestInit;

      if (isNodalConnect) {
        url = `${endpoint.url.replace(/\/$/, '')}/executables/run`;
        const requestBody = { name: query.name, inputs: {} };
        fetchOptions = { method: 'POST', headers, body: JSON.stringify(requestBody) };
      } else {
        url = endpoint.url.replace(/\/$/, '');
        const subPath = (query.api_sub_path || '').replace(/^\//, '').replace(/\/$/, '');
        if (subPath) url = `${url}/${subPath}`;

        const queryParams = query.query_parameters as Array<{ key: string; value: string; enabled: boolean }> | null;
        const enabledParams = queryParams?.filter(p => p.enabled && p.value);
        if (query.url_query_string) {
          url += `?${query.url_query_string}`;
        } else if (enabledParams && enabledParams.length > 0) {
          const paramString = enabledParams
            .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
            .join('&');
          url += `?${paramString}`;
        }

        fetchOptions = { method: query.http_method || 'GET', headers };
      }

      const response = await proxyFetch(url, fetchOptions);
      const responseData = await response.json();

      const items = extractRows(responseData);

      const valueField = query.lookup_value_field || 'id';
      const labelField = query.lookup_label_field || 'name';

      const options: LookupOption[] = items.map((item: unknown) => {
        const record = item as Record<string, unknown>;
        const val = String(record[valueField] ?? '');
        const lbl = String(record[labelField] ?? val);
        return { value: val, label: lbl };
      });

      console.log('[LookupResolver] resolveLookupByQueryId resolved', options.length, 'options');

      setLookupData(prev => ({
        ...prev,
        [key]: { options, loading: false, error: null }
      }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Lookup failed';
      console.error('[LookupResolver] Error:', errMsg, err);
      setLookupData(prev => ({
        ...prev,
        [key]: { options: [], loading: false, error: errMsg }
      }));
    }
  }, []);

  const resetLookups = useCallback(() => {
    setLookupData({});
    fetchedRef.current.clear();
  }, []);

  const getLookupState = useCallback((fixedValueId: string): LookupState => {
    return lookupData[fixedValueId] || { options: [], loading: false, error: null };
  }, [lookupData]);

  const getLookupStateByQueryId = useCallback((queryId: string): LookupState => {
    return lookupData[`query_${queryId}`] || { options: [], loading: false, error: null };
  }, [lookupData]);

  return {
    resolveLookup,
    resolveLookupByQueryId,
    getLookupState,
    getLookupStateByQueryId,
    lookupData,
    resetLookups
  };
}
