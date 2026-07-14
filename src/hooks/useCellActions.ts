import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DashboardCellActionWithQuery, ActionParameterMapping, PulseVariableMapping, ActionType, ActionVisibilityCondition } from '../types/database';

export function useCellActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActionsForCell = useCallback(async (cellId: string): Promise<DashboardCellActionWithQuery[]> => {
    const { data, error: fetchError } = await supabase
      .from('dashboard_cell_actions')
      .select(`
        *,
        queries (id, name, query_type, purpose_type, api_endpoint_id, api_sub_path, http_method, query_parameters, url_query_string, json_parameters, user_parameters, request_body_template, request_body_field_mappings)
      `)
      .eq('cell_id', cellId)
      .order('sort_order');

    if (fetchError) {
      console.error('[useCellActions] Error fetching actions:', fetchError);
      return [];
    }

    return (data || []) as DashboardCellActionWithQuery[];
  }, []);

  const saveActions = useCallback(async (
    cellId: string,
    actions: Array<{
      id?: string;
      action_type: ActionType;
      query_id: string;
      display_name: string;
      display_mode: 'context_menu' | 'button' | 'both';
      parameter_mappings: ActionParameterMapping[];
      popup_template: string;
      link_url_template: string;
      sort_order: number;
      refresh_after_execute: boolean;
      post_action_pulse_id?: string | null;
      pulse_variable_mappings?: PulseVariableMapping[];
      visibility_condition?: ActionVisibilityCondition | null;
      prompt_title?: string;
      prompt_description?: string;
    }>
  ): Promise<{ error: string | null }> => {
    setLoading(true);
    setError(null);

    try {
      const { data: existing } = await supabase
        .from('dashboard_cell_actions')
        .select('id')
        .eq('cell_id', cellId);

      const existingIds = (existing || []).map(a => a.id);
      const newIds = actions.filter(a => a.id).map(a => a.id!);
      const toDelete = existingIds.filter(id => !newIds.includes(id));

      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('dashboard_cell_actions')
          .delete()
          .in('id', toDelete);
        if (deleteError) throw deleteError;
      }

      for (const action of actions) {
        const actionData = {
          cell_id: cellId,
          query_id: (action.action_type === 'popup' || action.action_type === 'link') ? null : (action.query_id || null),
          display_name: action.display_name,
          display_mode: action.display_mode,
          parameter_mappings: action.parameter_mappings,
          popup_template: action.popup_template,
          link_url_template: action.action_type === 'link' ? action.link_url_template : null,
          action_type: action.action_type,
          sort_order: action.sort_order,
          refresh_after_execute: action.refresh_after_execute,
          post_action_pulse_id: action.post_action_pulse_id || null,
          pulse_variable_mappings: action.pulse_variable_mappings || [],
          visibility_condition: action.visibility_condition || null,
          prompt_title: action.prompt_title || null,
          prompt_description: action.prompt_description || null,
        };

        if (action.id) {
          const { error: updateError } = await supabase
            .from('dashboard_cell_actions')
            .update({ ...actionData, updated_at: new Date().toISOString() })
            .eq('id', action.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('dashboard_cell_actions')
            .insert(actionData);
          if (insertError) throw insertError;
        }
      }

      return { error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save actions';
      setError(msg);
      return { error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchActionsForCell,
    saveActions,
  };
}
