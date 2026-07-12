import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { EmailConfiguration, EmailProvider, O365Credentials, GmailCredentials } from '../types/database';

export interface EmailConfigFormData {
  name: string;
  provider: EmailProvider;
  send_from_email: string;
  credentials: O365Credentials | GmailCredentials;
  is_default: boolean;
}

export function useEmailConfigs() {
  const { activeCompany } = useAuth();
  const [configs, setConfigs] = useState<EmailConfiguration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    if (!activeCompany?.id) {
      setConfigs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('email_configurations')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching email configurations:', error);
    }

    setConfigs(data || []);
    setLoading(false);
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const saveConfig = async (id: string | null, formData: EmailConfigFormData) => {
    if (!activeCompany?.id) return { error: 'No active company' };

    const isConfigured = isFormComplete(formData);

    const record = {
      company_id: activeCompany.id,
      name: formData.name,
      provider: formData.provider,
      send_from_email: formData.send_from_email,
      credentials: formData.credentials as unknown as Record<string, unknown>,
      is_default: formData.is_default,
      is_configured: isConfigured,
      updated_at: new Date().toISOString(),
    };

    if (formData.is_default) {
      await supabase
        .from('email_configurations')
        .update({ is_default: false })
        .eq('company_id', activeCompany.id)
        .neq('id', id || '');
    }

    if (id) {
      const { error } = await supabase
        .from('email_configurations')
        .update(record)
        .eq('id', id);

      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from('email_configurations')
        .insert(record);

      if (error) return { error: error.message };
    }

    await fetchConfigs();
    return { error: null };
  };

  const deleteConfig = async (id: string) => {
    const { error } = await supabase
      .from('email_configurations')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchConfigs();
    return { error: null };
  };

  const setDefault = async (id: string) => {
    if (!activeCompany?.id) return { error: 'No active company' };

    await supabase
      .from('email_configurations')
      .update({ is_default: false })
      .eq('company_id', activeCompany.id);

    const { error } = await supabase
      .from('email_configurations')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchConfigs();
    return { error: null };
  };

  return { configs, loading, saveConfig, deleteConfig, setDefault, refetch: fetchConfigs };
}

function isFormComplete(formData: EmailConfigFormData): boolean {
  if (!formData.name || !formData.send_from_email) return false;

  if (formData.provider === 'office365') {
    const creds = formData.credentials as O365Credentials;
    return !!(creds.tenant_id && creds.client_id && creds.client_secret);
  }

  if (formData.provider === 'gmail') {
    const creds = formData.credentials as GmailCredentials;
    return !!(creds.client_id && creds.client_secret && creds.refresh_token);
  }

  return false;
}
