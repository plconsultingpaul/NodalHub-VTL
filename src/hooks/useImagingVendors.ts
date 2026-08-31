import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ImagingVendor, ImagingDocumentType } from '../types/database';

export interface ImagingVendorFormData {
  name: string;
  vendor_type: string;
  supabase_url: string;
  anon_key: string;
  default_bucket_id: string;
  notes: string;
  send_api_key: string;
  send_bucket_id: string;
  send_default_document_type_id: string;
}

export function useImagingVendors() {
  const { activeCompany } = useAuth();
  const [vendors, setVendors] = useState<ImagingVendor[]>([]);
  const [documentTypes, setDocumentTypes] = useState<ImagingDocumentType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!activeCompany?.id) {
      setVendors([]);
      setDocumentTypes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: vData, error: vErr } = await supabase
      .from('imaging_vendors')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: true });
    if (vErr) console.error('Error fetching imaging vendors:', vErr);
    const vList = (vData || []) as ImagingVendor[];
    setVendors(vList);

    if (vList.length > 0) {
      const ids = vList.map((v) => v.id);
      const { data: dData, error: dErr } = await supabase
        .from('imaging_document_types')
        .select('*')
        .in('vendor_id', ids)
        .order('sort_order', { ascending: true });
      if (dErr) console.error('Error fetching imaging document types:', dErr);
      setDocumentTypes((dData || []) as ImagingDocumentType[]);
    } else {
      setDocumentTypes([]);
    }
    setLoading(false);
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveVendor = async (id: string | null, form: ImagingVendorFormData) => {
    if (!activeCompany?.id) return { error: 'No active company', data: null as ImagingVendor | null };
    const record = {
      company_id: activeCompany.id,
      name: form.name,
      vendor_type: form.vendor_type,
      supabase_url: form.supabase_url,
      anon_key: form.anon_key,
      default_bucket_id: form.default_bucket_id || null,
      notes: form.notes || null,
      send_api_key: form.send_api_key || null,
      send_bucket_id: form.send_bucket_id || null,
      send_default_document_type_id: form.send_default_document_type_id || null,
      updated_at: new Date().toISOString(),
    };
    if (id) {
      const { data, error } = await supabase.from('imaging_vendors').update(record).eq('id', id).select().maybeSingle();
      if (error) return { error: error.message, data: null };
      await fetchAll();
      return { error: null, data: data as ImagingVendor };
    }
    const { data, error } = await supabase.from('imaging_vendors').insert(record).select().maybeSingle();
    if (error) return { error: error.message, data: null };
    await fetchAll();
    return { error: null, data: data as ImagingVendor };
  };

  const deleteVendor = async (id: string) => {
    const { error } = await supabase.from('imaging_vendors').delete().eq('id', id);
    if (error) return { error: error.message };
    await fetchAll();
    return { error: null };
  };

  const saveDocumentType = async (
    id: string | null,
    vendorId: string,
    form: { remote_id: string; name: string; sort_order: number }
  ) => {
    const record = {
      vendor_id: vendorId,
      remote_id: form.remote_id,
      name: form.name,
      sort_order: form.sort_order,
      updated_at: new Date().toISOString(),
    };
    if (id) {
      const { error } = await supabase.from('imaging_document_types').update(record).eq('id', id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from('imaging_document_types').insert(record);
      if (error) return { error: error.message };
    }
    await fetchAll();
    return { error: null };
  };

  const deleteDocumentType = async (id: string) => {
    const { error } = await supabase.from('imaging_document_types').delete().eq('id', id);
    if (error) return { error: error.message };
    await fetchAll();
    return { error: null };
  };

  return {
    vendors,
    documentTypes,
    loading,
    saveVendor,
    deleteVendor,
    saveDocumentType,
    deleteDocumentType,
    refetch: fetchAll,
  };
}
