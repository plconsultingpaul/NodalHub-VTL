import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ApiEndpoint, NodalDatabase } from '../types/database';

export function useEndpoints() {
  const { activeCompany, user } = useAuth();
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [nodalDatabases, setNodalDatabases] = useState<NodalDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEndpoints = useCallback(async () => {
    if (!activeCompany) {
      setEndpoints([]);
      setNodalDatabases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('api_endpoints')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setEndpoints(data || []);

      const { data: dbData, error: dbError } = await supabase
        .from('nodal_databases')
        .select('*')
        .eq('company_id', activeCompany.id)
        .order('created_at', { ascending: true });

      if (dbError) throw dbError;

      setNodalDatabases(dbData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch endpoints');
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  const getNodalConnectEndpoint = useCallback(() => {
    return endpoints.find(e => e.endpoint_type === 'nodal_connect') || null;
  }, [endpoints]);

  const createEndpoint = async (endpoint: Omit<ApiEndpoint, 'id' | 'created_at' | 'company_id' | 'created_by'>) => {
    if (!activeCompany || !user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('api_endpoints')
      .insert({
        ...endpoint,
        company_id: activeCompany.id,
        created_by: user.id
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await fetchEndpoints();
    return { data };
  };

  const updateEndpoint = async (id: string, updates: Partial<ApiEndpoint>) => {
    const { error } = await supabase
      .from('api_endpoints')
      .update(updates)
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchEndpoints();
    return { error: null };
  };

  const deleteEndpoint = async (id: string) => {
    const { error } = await supabase
      .from('api_endpoints')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchEndpoints();
    return { error: null };
  };

  const testEndpoint = async (endpoint: Partial<ApiEndpoint>): Promise<{ data?: unknown; error?: string; status?: number }> => {
    try {
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

      const response = await fetch(endpoint.url || '', {
        method: endpoint.method || 'GET',
        headers
      });

      const data = await response.json();
      return { data, status: response.status };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to test endpoint' };
    }
  };

  const createNodalDatabase = async (db: { name: string; connection_id: string; api_endpoint_id: string }) => {
    if (!activeCompany) return { error: 'No active company' };

    const { data, error } = await supabase
      .from('nodal_databases')
      .insert({
        ...db,
        company_id: activeCompany.id
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await fetchEndpoints();
    return { data };
  };

  const updateNodalDatabase = async (id: string, updates: { name?: string; connection_id?: string }) => {
    const { error } = await supabase
      .from('nodal_databases')
      .update(updates)
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchEndpoints();
    return { error: null };
  };

  const deleteNodalDatabase = async (id: string) => {
    const { error } = await supabase
      .from('nodal_databases')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchEndpoints();
    return { error: null };
  };

  return {
    endpoints,
    nodalDatabases,
    loading,
    error,
    refetch: fetchEndpoints,
    getNodalConnectEndpoint,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    testEndpoint,
    createNodalDatabase,
    updateNodalDatabase,
    deleteNodalDatabase
  };
}
