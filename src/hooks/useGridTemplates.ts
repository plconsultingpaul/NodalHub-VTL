import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { GridTemplate, GridTemplateColumnConfig, GridFormattingRules } from '../types/database';

export function useGridTemplates(dashboardId: string | null) {
  const [templates, setTemplates] = useState<GridTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    console.log('[useGridTemplates] fetchTemplates called with dashboardId:', dashboardId);
    if (!dashboardId) {
      console.log('[useGridTemplates] No dashboardId, clearing templates');
      setTemplates([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('grid_templates')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .order('is_default', { ascending: false })
      .order('name');

    console.log('[useGridTemplates] Fetch result:', { dashboardId, data, error: fetchError });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTemplates(data as GridTemplate[] || []);
    }

    setLoading(false);
  }, [dashboardId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (
    name: string,
    columnConfig: GridTemplateColumnConfig,
    formattingRules: GridFormattingRules,
    isDefault: boolean = false
  ): Promise<GridTemplate | null> => {
    console.log('[useGridTemplates] createTemplate called:', { dashboardId, name, isDefault });
    if (!dashboardId) {
      console.log('[useGridTemplates] createTemplate: No dashboardId, returning null');
      return null;
    }

    const { data, error: insertError } = await supabase
      .from('grid_templates')
      .insert({
        dashboard_id: dashboardId,
        name,
        is_default: isDefault,
        column_config: columnConfig,
        formatting_rules: formattingRules
      })
      .select()
      .single();

    console.log('[useGridTemplates] createTemplate result:', { data, error: insertError });

    if (insertError) {
      setError(insertError.message);
      return null;
    }

    await fetchTemplates();
    return data as GridTemplate;
  };

  const updateTemplate = async (
    templateId: string,
    columnConfig: GridTemplateColumnConfig,
    formattingRules?: GridFormattingRules
  ): Promise<boolean> => {
    console.log('[updateTemplate] Saving templateId:', templateId);
    console.log('[updateTemplate] columnConfig being saved:', JSON.stringify(columnConfig, null, 2));

    const updateData: Record<string, unknown> = {
      column_config: columnConfig,
      updated_at: new Date().toISOString()
    };

    if (formattingRules !== undefined) {
      updateData.formatting_rules = formattingRules;
    }

    const { error: updateError } = await supabase
      .from('grid_templates')
      .update(updateData)
      .eq('id', templateId);

    if (updateError) {
      console.log('[updateTemplate] Error:', updateError.message);
      setError(updateError.message);
      return false;
    }

    console.log('[updateTemplate] Database update complete, fetching templates...');
    await fetchTemplates();
    console.log('[updateTemplate] Templates refreshed, new templates:', JSON.stringify(templates.map(t => ({ id: t.id, name: t.name }))));
    return true;
  };

  const deleteTemplate = async (templateId: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('grid_templates')
      .delete()
      .eq('id', templateId);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    await fetchTemplates();
    return true;
  };

  const setDefaultTemplate = async (templateId: string): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from('grid_templates')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', templateId);

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    await fetchTemplates();
    return true;
  };

  const updateFormattingRules = async (
    templateId: string,
    formattingRules: GridFormattingRules
  ): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from('grid_templates')
      .update({
        formatting_rules: formattingRules,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId);

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    await fetchTemplates();
    return true;
  };

  const getDefaultTemplate = useCallback((): GridTemplate | null => {
    return templates.find(t => t.is_default) || null;
  }, [templates]);

  return {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    updateFormattingRules,
    getDefaultTemplate,
    refetch: fetchTemplates
  };
}
