import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Contact {
  id: string;
  company_id: string;
  name: string;
  email: string;
  created_at: string;
  created_by: string | null;
}

export function useContacts() {
  const { activeCompany } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    if (!activeCompany?.id) {
      setContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('name');

    if (!error && data) {
      setContacts(data);
    }
    setLoading(false);
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const createContact = async (name: string, email: string) => {
    if (!activeCompany?.id) return { error: 'No company selected' };

    const { error } = await supabase.from('contacts').insert({
      company_id: activeCompany.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
    });

    if (error) {
      if (error.code === '23505') return { error: 'A contact with this email already exists' };
      return { error: error.message };
    }

    await fetchContacts();
    return { error: null };
  };

  const updateContact = async (id: string, name: string, email: string) => {
    const { error } = await supabase
      .from('contacts')
      .update({ name: name.trim(), email: email.trim().toLowerCase() })
      .eq('id', id);

    if (error) {
      if (error.code === '23505') return { error: 'A contact with this email already exists' };
      return { error: error.message };
    }

    await fetchContacts();
    return { error: null };
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) return { error: error.message };
    await fetchContacts();
    return { error: null };
  };

  return { contacts, loading, createContact, updateContact, deleteContact, refetch: fetchContacts };
}
