import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
  DashboardCell,
  DashboardCellDrilldown,
  DashboardCellWithRelations
} from '../types/database';

export function useDashboardConfig(dashboardId: string | null) {
  const [cells, setCells] = useState<DashboardCellWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCells = useCallback(async () => {
    console.log('[useDashboardConfig] fetchCells called, dashboardId:', dashboardId);

    if (!dashboardId) {
      console.log('[useDashboardConfig] No dashboardId, clearing cells');
      setCells([]);
      setLoading(false);
      return;
    }

    console.log('[useDashboardConfig] Setting loading=true, KEEPING OLD CELLS (this is the bug!)');
    setLoading(true);
    setError(null);

    try {
      console.log('[useDashboardConfig] Fetching cells from database...');
      const { data: cellsData, error: cellsError } = await supabase
        .from('dashboard_cells')
        .select(`
          *,
          queries (id, name, query_type, api_endpoint_id, api_sub_path, http_method, query_parameters, url_query_string, json_parameters, user_parameters, request_body_template, request_body_field_mappings)
        `)
        .eq('dashboard_id', dashboardId)
        .order('row_index')
        .order('col_index');

      console.log('[useDashboardConfig] Cells query result:', { cellsData, cellsError });
      if (cellsData) {
        cellsData.forEach((cell, i) => {
          console.log(`[useDashboardConfig] Cell ${i} query:`, cell.queries);
        });
      }

      if (cellsError) throw cellsError;

      const cellIds = cellsData?.map(c => c.id) || [];
      console.log('[useDashboardConfig] Cell IDs:', cellIds);

      let drilldownsData: DashboardCellDrilldown[] = [];

      if (cellIds.length > 0) {
        const { data: drilldowns, error: drilldownsError } = await supabase
          .from('dashboard_cell_drilldowns')
          .select(`
            *,
            queries (id, name, query_type, api_endpoint_id, api_sub_path, http_method, query_parameters, url_query_string, json_parameters, user_parameters, request_body_template, request_body_field_mappings)
          `)
          .in('cell_id', cellIds)
          .order('sort_order');

        console.log('[useDashboardConfig] Drilldowns query result:', { drilldowns, drilldownsError });

        if (drilldownsError) throw drilldownsError;
        drilldownsData = drilldowns || [];
      }

      const cellsWithDrilldowns: DashboardCellWithRelations[] = (cellsData || []).map(cell => ({
        ...cell,
        drilldowns: drilldownsData
          .filter(d => d.cell_id === cell.id)
          .map(d => ({
            ...d,
            queries: (d as { queries?: unknown }).queries || null
          }))
      }));

      console.log('[useDashboardConfig] Final cells with drilldowns:', cellsWithDrilldowns);
      setCells(cellsWithDrilldowns);
    } catch (err) {
      console.error('[useDashboardConfig] Error fetching cells:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch cells');
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    fetchCells();
  }, [fetchCells]);

  const createCell = async (
    cell: Omit<DashboardCell, 'id' | 'created_at' | 'updated_at'>
  ) => {
    const { data, error } = await supabase
      .from('dashboard_cells')
      .insert(cell)
      .select()
      .single();

    if (error) return { error: error.message };
    await fetchCells();
    return { data };
  };

  const updateCell = async (id: string, updates: Partial<DashboardCell>) => {
    const { error } = await supabase
      .from('dashboard_cells')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { error: error.message };
    await fetchCells();
    return { error: null };
  };

  const deleteCell = async (id: string) => {
    const { error } = await supabase
      .from('dashboard_cells')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };
    await fetchCells();
    return { error: null };
  };

  const createDrilldown = async (
    drilldown: Omit<DashboardCellDrilldown, 'id' | 'created_at'>
  ) => {
    const { data, error } = await supabase
      .from('dashboard_cell_drilldowns')
      .insert(drilldown)
      .select()
      .single();

    if (error) return { error: error.message };
    await fetchCells();
    return { data };
  };

  const updateDrilldown = async (id: string, updates: Partial<DashboardCellDrilldown>) => {
    const { error } = await supabase
      .from('dashboard_cell_drilldowns')
      .update(updates)
      .eq('id', id);

    if (error) return { error: error.message };
    await fetchCells();
    return { error: null };
  };

  const deleteDrilldown = async (id: string) => {
    const { error } = await supabase
      .from('dashboard_cell_drilldowns')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };
    await fetchCells();
    return { error: null };
  };

  const saveCellsLayout = async (
    cellsLayout: Array<{
      id?: string;
      query_id: string | null;
      title: string;
      row_index: number;
      col_index: number;
      row_span: number;
      col_span: number;
      width_percent: number;
      height_percent: number;
      enable_row_selection?: boolean;
      check_drilldown_existence?: boolean;
      show_parameters_in_header?: boolean;
      auto_group_by_column?: string | null;
      auto_group_collapsed?: boolean;
      settings?: Record<string, unknown>;
      drilldowns?: Array<{
        id?: string;
        query_id: string;
        display_name: string;
        link_field: string;
        sort_order: number;
        parameter_mappings?: Record<string, string>;
      }>;
    }>,
    overrideDashboardId?: string
  ) => {
    const targetDashboardId = overrideDashboardId || dashboardId;
    if (!targetDashboardId) return { error: 'No dashboard selected' };

    try {
      const existingCellIds = cells.map(c => c.id);
      const newCellIds = cellsLayout.filter(c => c.id).map(c => c.id!);
      const cellsToDelete = existingCellIds.filter(id => !newCellIds.includes(id));

      if (cellsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('dashboard_cells')
          .delete()
          .in('id', cellsToDelete);
        if (deleteError) throw deleteError;
      }

      for (const cellLayout of cellsLayout) {
        const cellData = {
          dashboard_id: targetDashboardId,
          query_id: cellLayout.query_id,
          title: cellLayout.title,
          row_index: cellLayout.row_index,
          col_index: cellLayout.col_index,
          row_span: cellLayout.row_span,
          col_span: cellLayout.col_span,
          width_percent: cellLayout.width_percent,
          height_percent: cellLayout.height_percent,
          enable_row_selection: cellLayout.enable_row_selection ?? false,
          check_drilldown_existence: cellLayout.check_drilldown_existence ?? false,
          show_parameters_in_header: cellLayout.show_parameters_in_header ?? false,
          auto_group_by_column: cellLayout.auto_group_by_column ?? null,
          auto_group_collapsed: cellLayout.auto_group_collapsed ?? false,
          settings: cellLayout.settings || {}
        };

        let cellId = cellLayout.id;

        if (cellLayout.id) {
          const { error: updateError } = await supabase
            .from('dashboard_cells')
            .update({ ...cellData, updated_at: new Date().toISOString() })
            .eq('id', cellLayout.id);
          if (updateError) throw updateError;
        } else {
          const { data: newCell, error: insertError } = await supabase
            .from('dashboard_cells')
            .insert(cellData)
            .select()
            .single();
          if (insertError) throw insertError;
          cellId = newCell.id;
        }

        if (cellLayout.drilldowns && cellId) {
          const existingCell = cells.find(c => c.id === cellLayout.id);
          const existingDrilldownIds = existingCell?.drilldowns?.map(d => d.id) || [];
          const newDrilldownIds = cellLayout.drilldowns.filter(d => d.id).map(d => d.id!);
          const drilldownsToDelete = existingDrilldownIds.filter(id => !newDrilldownIds.includes(id));

          if (drilldownsToDelete.length > 0) {
            const { error: deleteDrillError } = await supabase
              .from('dashboard_cell_drilldowns')
              .delete()
              .in('id', drilldownsToDelete);
            if (deleteDrillError) throw deleteDrillError;
          }

          for (const drilldown of cellLayout.drilldowns) {
            const drilldownData = {
              cell_id: cellId,
              query_id: drilldown.query_id,
              display_name: drilldown.display_name,
              link_field: drilldown.link_field,
              sort_order: drilldown.sort_order,
              parameter_mappings: drilldown.parameter_mappings || {}
            };

            if (drilldown.id) {
              const { error: updateDrillError } = await supabase
                .from('dashboard_cell_drilldowns')
                .update(drilldownData)
                .eq('id', drilldown.id);
              if (updateDrillError) throw updateDrillError;
            } else {
              const { error: insertDrillError } = await supabase
                .from('dashboard_cell_drilldowns')
                .insert(drilldownData);
              if (insertDrillError) throw insertDrillError;
            }
          }
        }
      }

      await fetchCells();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to save layout' };
    }
  };

  return {
    cells,
    loading,
    error,
    refetch: fetchCells,
    createCell,
    updateCell,
    deleteCell,
    createDrilldown,
    updateDrilldown,
    deleteDrilldown,
    saveCellsLayout
  };
}
