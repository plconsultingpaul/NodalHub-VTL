import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface SsoApplication {
  id: string;
  company_id: string;
  name: string;
  url: string;
  app_identifier: string;
  icon_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SsoApplicationFormData {
  name: string;
  url: string;
  app_identifier: string;
  icon_url: string;
  sort_order: number;
}

export function useSsoApplications() {
  const { activeCompany } = useAuth();
  const [applications, setApplications] = useState<SsoApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!activeCompany?.id) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('sso_applications')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching SSO applications:', error);
    }

    setApplications(data || []);
    setLoading(false);
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    if (!activeCompany?.id) return;

    const handleRefresh = () => { fetchApplications(); };
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('sso-applications-changed', handleRefresh);

    const channel = supabase
      .channel(`sso_applications_${activeCompany.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sso_applications',
        filter: `company_id=eq.${activeCompany.id}`,
      }, () => {
        fetchApplications();
      })
      .subscribe();

    return () => {
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('sso-applications-changed', handleRefresh);
      supabase.removeChannel(channel);
    };
  }, [activeCompany?.id, fetchApplications]);

  const saveApplication = async (id: string | null, formData: SsoApplicationFormData) => {
    if (!activeCompany?.id) return { error: 'No active company' };

    const record = {
      company_id: activeCompany.id,
      name: formData.name,
      url: formData.url,
      app_identifier: formData.app_identifier,
      icon_url: formData.icon_url || null,
      sort_order: formData.sort_order,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await supabase
        .from('sso_applications')
        .update(record)
        .eq('id', id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from('sso_applications')
        .insert(record);
      if (error) return { error: error.message };
    }

    await fetchApplications();
    window.dispatchEvent(new Event('sso-applications-changed'));
    return { error: null };
  };

  const deleteApplication = async (id: string) => {
    const { error } = await supabase
      .from('sso_applications')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchApplications();
    window.dispatchEvent(new Event('sso-applications-changed'));
    return { error: null };
  };

  return { applications, loading, saveApplication, deleteApplication, refetch: fetchApplications };
}