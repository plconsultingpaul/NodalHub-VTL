import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Pulse, PulseInsert, PulseUpdate } from '../types/database';

export function usePulses() {
  const { activeCompany, user } = useAuth();
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPulses = useCallback(async () => {
    if (!activeCompany) {
      setPulses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('pulses')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setPulses(data || []);
    }

    setLoading(false);
  }, [activeCompany]);

  useEffect(() => {
    fetchPulses();
  }, [fetchPulses]);

  const createPulse = async (
    projectId: string,
    name: string,
    description: string = ''
  ) => {
    if (!activeCompany || !user) return { error: 'Not authenticated' };

    const insert: PulseInsert = {
      company_id: activeCompany.id,
      project_id: projectId,
      name,
      description,
      created_by: user.id,
    };

    const { data, error: insertError } = await supabase
      .from('pulses')
      .insert(insert)
      .select()
      .maybeSingle();

    if (insertError) return { error: insertError.message };

    await fetchPulses();
    return { data };
  };

  const updatePulse = async (id: string, updates: PulseUpdate) => {
    const { error: updateError } = await supabase
      .from('pulses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) return { error: updateError.message };

    await fetchPulses();
    return { error: null };
  };

  const deletePulse = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('pulses')
      .delete()
      .eq('id', id);

    if (deleteError) return { error: deleteError.message };

    await fetchPulses();
    return { error: null };
  };

  const togglePulseActive = async (id: string, isActive: boolean) => {
    return updatePulse(id, { is_active: isActive });
  };

  const duplicatePulse = async (id: string) => {
    if (!activeCompany || !user) return { error: 'Not authenticated' };

    const { data: source, error: sourceErr } = await supabase
      .from('pulses')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (sourceErr || !source) return { error: sourceErr?.message || 'Pulse not found' };

    const insert: PulseInsert = {
      company_id: source.company_id,
      project_id: source.project_id,
      name: `${source.name} (Copy)`,
      description: source.description,
      is_active: false,
      query_id: source.query_id,
      run_mode: source.run_mode,
      group_by_field: source.group_by_field,
      created_by: user.id,
      trigger_type: source.trigger_type,
      input_variables: source.input_variables,
      canvas_data: source.canvas_data,
      step_configs: source.step_configs,
      workflow_version: source.workflow_version,
    };

    const { data: copy, error: insertErr } = await supabase
      .from('pulses')
      .insert(insert)
      .select()
      .maybeSingle();
    if (insertErr || !copy) return { error: insertErr?.message || 'Failed to duplicate pulse' };

    const [{ data: srcExport }, { data: srcEmail }, { data: srcSchedule }] = await Promise.all([
      supabase.from('pulse_exports').select('*').eq('pulse_id', id).maybeSingle(),
      supabase.from('pulse_emails').select('*').eq('pulse_id', id).maybeSingle(),
      supabase.from('pulse_schedules').select('*').eq('pulse_id', id).maybeSingle(),
    ]);

    const inserts: Promise<unknown>[] = [];
    if (srcExport) {
      inserts.push(
        supabase.from('pulse_exports').insert({
          pulse_id: copy.id,
          enabled: srcExport.enabled,
          format: srcExport.format,
          filename_template: srcExport.filename_template,
          include_headers: srcExport.include_headers,
        })
      );
    }
    if (srcEmail) {
      inserts.push(
        supabase.from('pulse_emails').insert({
          pulse_id: copy.id,
          enabled: srcEmail.enabled,
          to_recipients: srcEmail.to_recipients,
          cc_recipients: srcEmail.cc_recipients,
          bcc_recipients: srcEmail.bcc_recipients,
          subject_template: srcEmail.subject_template,
          body_template: srcEmail.body_template,
          attach_export: srcEmail.attach_export,
          only_send_if_results: srcEmail.only_send_if_results,
        })
      );
    }
    if (srcSchedule) {
      inserts.push(
        supabase.from('pulse_schedules').insert({
          pulse_id: copy.id,
          enabled: false,
          cron_expression: srcSchedule.cron_expression,
          timezone: srcSchedule.timezone,
        })
      );
    }
    await Promise.all(inserts);

    await fetchPulses();
    return { data: copy };
  };

  const getPulse = async (id: string): Promise<Pulse | null> => {
    const { data, error: fetchError } = await supabase
      .from('pulses')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      return null;
    }

    return data;
  };

  return {
    pulses,
    loading,
    error,
    refetch: fetchPulses,
    createPulse,
    updatePulse,
    deletePulse,
    togglePulseActive,
    duplicatePulse,
    getPulse,
  };
}
