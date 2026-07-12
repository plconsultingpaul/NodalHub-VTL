import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { computeNextCronRun } from '../lib/cronNext';
import type {
  PulseSchedule,
  PulseExport,
  PulseEmail,
  PulsePostRunStep,
  PulseExecution,
} from '../types/database';

export function usePulseConfig(pulseId: string | null) {
  const [schedule, setSchedule] = useState<PulseSchedule | null>(null);
  const [exportConfig, setExportConfig] = useState<PulseExport | null>(null);
  const [email, setEmail] = useState<PulseEmail | null>(null);
  const [postRunSteps, setPostRunSteps] = useState<PulsePostRunStep[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<PulseExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!pulseId) {
      setSchedule(null);
      setExportConfig(null);
      setEmail(null);
      setPostRunSteps([]);
      setRecentExecutions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [scheduleRes, exportRes, emailRes, stepsRes, executionsRes] = await Promise.all([
        supabase.from('pulse_schedules').select('*').eq('pulse_id', pulseId).maybeSingle(),
        supabase.from('pulse_exports').select('*').eq('pulse_id', pulseId).maybeSingle(),
        supabase.from('pulse_emails').select('*').eq('pulse_id', pulseId).maybeSingle(),
        supabase
          .from('pulse_post_run_steps')
          .select('*')
          .eq('pulse_id', pulseId)
          .order('sort_order'),
        supabase
          .from('pulse_executions')
          .select('*')
          .eq('pulse_id', pulseId)
          .order('started_at', { ascending: false })
          .limit(20),
      ]);

      if (scheduleRes.error) throw scheduleRes.error;
      if (exportRes.error) throw exportRes.error;
      if (emailRes.error) throw emailRes.error;
      if (stepsRes.error) throw stepsRes.error;
      if (executionsRes.error) throw executionsRes.error;

      setSchedule(scheduleRes.data);
      setExportConfig(exportRes.data);
      setEmail(emailRes.data);
      setPostRunSteps(stepsRes.data || []);
      setRecentExecutions(executionsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pulse config');
    } finally {
      setLoading(false);
    }
  }, [pulseId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const upsertSchedule = async (updates: Partial<PulseSchedule>) => {
    if (!pulseId) return { error: 'No pulse selected' };

    const payload: Record<string, unknown> = {
      pulse_id: pulseId,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.enabled === false) {
      payload.next_run_at = null;
    } else if (updates.cron_expression) {
      const tz = (updates.timezone as string) || (schedule?.timezone as string) || 'UTC';
      payload.next_run_at = computeNextCronRun(updates.cron_expression, tz);
    }

    const { error: upsertError } = await supabase
      .from('pulse_schedules')
      .upsert(payload, { onConflict: 'pulse_id' });

    if (upsertError) return { error: upsertError.message };
    await fetchConfig();
    return { error: null };
  };

  const upsertExport = async (updates: Partial<PulseExport>) => {
    if (!pulseId) return { error: 'No pulse selected' };

    const { error: upsertError } = await supabase
      .from('pulse_exports')
      .upsert(
        { pulse_id: pulseId, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'pulse_id' }
      );

    if (upsertError) return { error: upsertError.message };
    await fetchConfig();
    return { error: null };
  };

  const upsertEmail = async (updates: Partial<PulseEmail>) => {
    if (!pulseId) return { error: 'No pulse selected' };

    const { error: upsertError } = await supabase
      .from('pulse_emails')
      .upsert(
        { pulse_id: pulseId, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'pulse_id' }
      );

    if (upsertError) return { error: upsertError.message };
    await fetchConfig();
    return { error: null };
  };

  const addPostRunStep = async (name: string) => {
    if (!pulseId) return { error: 'No pulse selected' };

    const nextSortOrder = postRunSteps.length;
    const { data, error: insertError } = await supabase
      .from('pulse_post_run_steps')
      .insert({ pulse_id: pulseId, name, sort_order: nextSortOrder, config: {} })
      .select()
      .maybeSingle();

    if (insertError) return { error: insertError.message };
    await fetchConfig();
    return { data };
  };

  const updatePostRunStep = async (id: string, updates: Partial<PulsePostRunStep>) => {
    const { error: updateError } = await supabase
      .from('pulse_post_run_steps')
      .update(updates)
      .eq('id', id);

    if (updateError) return { error: updateError.message };
    await fetchConfig();
    return { error: null };
  };

  const deletePostRunStep = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('pulse_post_run_steps')
      .delete()
      .eq('id', id);

    if (deleteError) return { error: deleteError.message };
    await fetchConfig();
    return { error: null };
  };

  return {
    schedule,
    exportConfig,
    email,
    postRunSteps,
    recentExecutions,
    loading,
    error,
    refetch: fetchConfig,
    upsertSchedule,
    upsertExport,
    upsertEmail,
    addPostRunStep,
    updatePostRunStep,
    deletePostRunStep,
  };
}
