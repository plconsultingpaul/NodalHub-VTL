import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DashboardWidget } from '../types/database';

export function useWidgets(dashboardId: string | undefined) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWidgets = useCallback(async () => {
    if (!dashboardId) {
      setWidgets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('dashboard_widgets')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .order('position_y', { ascending: true })
        .order('position_x', { ascending: true });

      if (fetchError) throw fetchError;

      setWidgets(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch widgets');
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    fetchWidgets();
  }, [fetchWidgets]);

  const createWidget = async (widget: Omit<DashboardWidget, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('dashboard_widgets')
      .insert(widget)
      .select()
      .single();

    if (error) return { error: error.message };

    await fetchWidgets();
    return { data };
  };

  const updateWidget = async (id: string, updates: Partial<DashboardWidget>) => {
    const { error } = await supabase
      .from('dashboard_widgets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchWidgets();
    return { error: null };
  };

  const deleteWidget = async (id: string) => {
    const { error } = await supabase
      .from('dashboard_widgets')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    await fetchWidgets();
    return { error: null };
  };

  return {
    widgets,
    loading,
    error,
    refetch: fetchWidgets,
    createWidget,
    updateWidget,
    deleteWidget
  };
}
