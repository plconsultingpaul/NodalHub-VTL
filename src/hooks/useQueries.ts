import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { proxyFetch } from '../lib/apiProxy';
import { useAuth } from '../contexts/AuthContext';
import type { Query, QueryWithRelations, ApiEndpoint, ApiSpecEndpoint, ApiEndpointField } from '../types/database';

export interface QueryParameter {
  key: string;
  value: string;
  type: string;
  description: string;
  example: string | null;
  enabled: boolean;
  required: boolean;
}

const encodeParamValue = (key: string, value: string): string => {
  const odataParams = ['$select', '$orderby', '$filter', '$expand', 'select', 'orderby', 'filter', 'expand'];
  const isODataParam = odataParams.some(p => key.toLowerCase() === p.toLowerCase());

  if (isODataParam) {
    return encodeURIComponent(value).replace(/%2C/g, ',').replace(/%20/g, ' ');
  }
  return encodeURIComponent(value);
};

function substitutePathVariables(path: string, config: Record<string, string>): string {
  return path.replace(/\{([^}]+)\}/g, (match, varName) => {
    const value = config[varName];
    if (value !== undefined && value !== '') {
      return encodeURIComponent(value);
    }
    return match;
  });
}

export function useQueries() {
  const { activeCompany, user } = useAuth();
  const [queries, setQueries] = useState<QueryWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueries = useCallback(async () => {
    if (!activeCompany?.id) {
      setQueries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('queries')
        .select(`
          *,
          api_endpoints (id, name, url, auth_type, auth_config, headers),
          api_spec_endpoints (id, path, method, summary)
        `)
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setQueries(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch queries');
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  const createQuery = async (
    query: Omit<Query, 'id' | 'created_at' | 'updated_at' | 'company_id' | 'created_by'>
  ) => {
    if (!activeCompany?.id || !user?.id) return { error: 'Not authenticated' };

    const insertData = {
      ...query,
      company_id: activeCompany.id,
      created_by: user.id
    };

    const { data, error } = await supabase
      .from('queries')
      .insert(insertData)
      .select()
      .single();

    if (error) return { error: error.message };
    await fetchQueries();
    return { data };
  };

  const updateQuery = async (id: string, updates: Partial<Query>) => {
    const updateData = { ...updates, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from('queries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };
    await fetchQueries();
    return { error: null };
  };

  const deleteQuery = async (id: string) => {
    const { error } = await supabase
      .from('queries')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };
    await fetchQueries();
    return { error: null };
  };

  const getSpecEndpointsForEndpoint = useCallback(async (apiEndpointId: string): Promise<ApiSpecEndpoint[]> => {
    const { data: specs } = await supabase
      .from('api_specs')
      .select('id')
      .eq('api_endpoint_id', apiEndpointId);

    if (!specs?.length) return [];

    const specIds = specs.map(s => s.id);
    const { data: endpoints } = await supabase
      .from('api_spec_endpoints')
      .select('*')
      .in('api_spec_id', specIds)
      .order('path');

    return endpoints || [];
  }, []);

  const getFieldsForSpecEndpoint = useCallback(async (specEndpointId: string): Promise<ApiEndpointField[]> => {
    const { data } = await supabase
      .from('api_endpoint_fields')
      .select('*')
      .eq('api_spec_endpoint_id', specEndpointId)
      .order('field_path');

    return data || [];
  }, []);

  const testQuery = async (
    endpoint: ApiEndpoint,
    subPath: string,
    method: string,
    params: QueryParameter[],
    urlQueryString: string,
    jsonParams: Record<string, unknown>,
    pathVariableConfig?: Record<string, string>
  ): Promise<{ data?: unknown; error?: string; status?: number; fullUrl?: string }> => {
    try {
      const baseUrl = endpoint.url.replace(/\/$/, '');
      let resolvedSubPath = subPath;
      if (pathVariableConfig) {
        resolvedSubPath = substitutePathVariables(resolvedSubPath, pathVariableConfig);
      }
      const normalizedSubPath = resolvedSubPath.replace(/^\//, '').replace(/\/$/, '');
      let url = normalizedSubPath ? `${baseUrl}/${normalizedSubPath}` : baseUrl;

      const enabledParams = params.filter(p => p.enabled && p.value);
      if (urlQueryString) {
        url += `?${urlQueryString}`;
      } else if (enabledParams.length > 0) {
        const queryString = enabledParams
          .map(p => `${encodeURIComponent(p.key)}=${encodeParamValue(p.key, p.value)}`)
          .join('&');
        url += `?${queryString}`;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(endpoint.headers as Record<string, string> || {})
      };

      if (endpoint.auth_type === 'bearer') {
        const config = endpoint.auth_config as { token?: string };
        if (config?.token) {
          headers['Authorization'] = `Bearer ${config.token}`;
        }
      } else if (endpoint.auth_type === 'api_key') {
        const config = endpoint.auth_config as { header_name?: string; api_key?: string };
        if (config?.header_name && config?.api_key) {
          headers[config.header_name] = config.api_key;
        }
      } else if (endpoint.auth_type === 'basic') {
        const config = endpoint.auth_config as { username?: string; password?: string };
        if (config?.username && config?.password) {
          headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
        }
      }

      const fetchOptions: RequestInit = {
        method,
        headers
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && Object.keys(jsonParams).length > 0) {
        fetchOptions.body = JSON.stringify(jsonParams);
      }

      const response = await proxyFetch(url, {
        method,
        headers,
        body: fetchOptions.body as string | undefined,
      });
      const data = await response.json();
      return { data, status: response.status, fullUrl: url };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to test query' };
    }
  };

  const buildFullUrl = (
    endpoint: ApiEndpoint | null,
    subPath: string,
    params: QueryParameter[],
    urlQueryString: string,
    pathVariableConfig?: Record<string, string>
  ): string => {
    if (!endpoint) return '';

    const baseUrl = endpoint.url.replace(/\/$/, '');
    let resolvedSubPath = subPath;
    if (pathVariableConfig) {
      resolvedSubPath = substitutePathVariables(resolvedSubPath, pathVariableConfig);
    }
    const normalizedSubPath = resolvedSubPath.replace(/^\//, '').replace(/\/$/, '');
    let url = normalizedSubPath ? `${baseUrl}/${normalizedSubPath}` : baseUrl;

    const enabledParams = params.filter(p => p.enabled && p.value);
    if (urlQueryString) {
      url += `?${urlQueryString}`;
    } else if (enabledParams.length > 0) {
      const queryString = enabledParams
        .map(p => `${encodeURIComponent(p.key)}=${encodeParamValue(p.key, p.value)}`)
        .join('&');
      url += `?${queryString}`;
    }

    return url;
  };

  return {
    queries,
    loading,
    error,
    refetch: fetchQueries,
    createQuery,
    updateQuery,
    deleteQuery,
    getSpecEndpointsForEndpoint,
    getFieldsForSpecEndpoint,
    testQuery,
    buildFullUrl
  };
}
