import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Save, Grid3x3 as Grid3X3, LayoutGrid, Settings, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { proxyFetch } from '../../lib/apiProxy';
import { useActiveDashboards } from '../../contexts/ActiveDashboardsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useQueries } from '../../hooks/useQueries';
import { useDashboardConfig } from '../../hooks/useDashboardConfig';
import { useProjects } from '../../hooks/useProjects';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import CellConfigPanel from './CellConfigPanel';
import ActionsConfigModal from '../DashboardViewer/ActionsConfigModal';
import type { Dashboard } from '../../types/database';

interface DrilldownConfig {
  id?: string;
  query_id: string;
  display_name: string;
  link_field: string;
  sort_order: number;
  parameter_mappings: Record<string, string>;
}

interface CellConfig {
  id?: string;
  query_id: string | null;
  title: string;
  row_index: number;
  col_index: number;
  row_span: number;
  col_span: number;
  width_percent: number;
  height_percent: number;
  enable_row_selection: boolean;
  check_drilldown_existence: boolean;
  show_parameters_in_header: boolean;
  auto_group_by_column: string | null;
  auto_group_collapsed: boolean;
  drilldowns: DrilldownConfig[];
}

const MIN_CELL_PERCENT = 10;

export default function DashboardBuilder() {
  const { builderProjectId, builderDashboardId, builderInitialName, closeBuilder } = useActiveDashboards();
  const { activeCompany, user, getDashboardAccess } = useAuth();
  const { queries } = useQueries();
  const { refetch: refetchProjects } = useProjects();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashboardName, setDashboardName] = useState('');
  const [cells, setCells] = useState<CellConfig[]>([]);
  const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [actionsModalOpen, setActionsModalOpen] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const saveInProgressRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [resizing, setResizing] = useState<{
    type: 'horizontal' | 'vertical';
    rowIndex: number;
    cellIndex?: number;
    startX: number;
    startY: number;
  } | null>(null);

  const { cells: existingCells, saveCellsLayout } = useDashboardConfig(builderDashboardId);

  useEffect(() => {
    if (builderDashboardId && getDashboardAccess(builderDashboardId) !== 'edit') {
      closeBuilder();
    }
  }, [builderDashboardId, getDashboardAccess, closeBuilder]);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!builderDashboardId) {
        setCells([{
          query_id: null,
          title: '',
          row_index: 0,
          col_index: 0,
          row_span: 1,
          col_span: 1,
          width_percent: 100,
          height_percent: 100,
          enable_row_selection: false,
          check_drilldown_existence: false,
          show_parameters_in_header: false,
          auto_group_by_column: null,
          auto_group_collapsed: false,
          drilldowns: []
        }]);
        setDashboardName(builderInitialName || '');
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('dashboards')
        .select('*')
        .eq('id', builderDashboardId)
        .maybeSingle();

      if (data) {
        setDashboard(data);
        setDashboardName(data.name);
      }
      setLoading(false);
    };

    loadDashboard();
  }, [builderDashboardId]);

  useEffect(() => {
    if (existingCells.length > 0) {
      setCells(existingCells.map(c => ({
        id: c.id,
        query_id: c.query_id,
        title: c.title,
        row_index: c.row_index,
        col_index: c.col_index,
        row_span: c.row_span,
        col_span: c.col_span,
        width_percent: c.width_percent ?? 100,
        height_percent: c.height_percent ?? 100,
        enable_row_selection: c.enable_row_selection ?? false,
        check_drilldown_existence: c.check_drilldown_existence ?? false,
        show_parameters_in_header: (c as { show_parameters_in_header?: boolean }).show_parameters_in_header ?? false,
        auto_group_by_column: (c as { auto_group_by_column?: string | null }).auto_group_by_column ?? null,
        auto_group_collapsed: (c as { auto_group_collapsed?: boolean }).auto_group_collapsed ?? false,
        drilldowns: c.drilldowns?.map(d => ({
          id: d.id,
          query_id: d.query_id,
          display_name: d.display_name,
          link_field: d.link_field,
          sort_order: d.sort_order,
          parameter_mappings: (d.parameter_mappings as Record<string, string>) || {}
        })) || []
      })));
    } else if (!builderDashboardId) {
      setCells([{
        query_id: null,
        title: '',
        row_index: 0,
        col_index: 0,
        row_span: 1,
        col_span: 1,
        width_percent: 100,
        height_percent: 100,
        enable_row_selection: false,
        check_drilldown_existence: false,
        show_parameters_in_header: false,
        auto_group_by_column: null,
        auto_group_collapsed: false,
        drilldowns: []
      }]);
    }
  }, [existingCells, builderDashboardId]);

  useEffect(() => {
    const fetchColumns = async () => {
      if (selectedCellIndex === null) {
        setAvailableColumns([]);
        return;
      }
      const cell = cells[selectedCellIndex];
      const selectedQuery = queries.find(q => q.id === cell?.query_id);
      if (!selectedQuery) {
        setAvailableColumns([]);
        return;
      }

      const queryParams = selectedQuery.query_parameters as Array<{ key: string; value: string; enabled: boolean }> | null;
      const selectParam = queryParams?.find(p => (p.key === '$select' || p.key === 'select') && p.enabled && p.value);

      if (selectParam?.value) {
        setAvailableColumns(selectParam.value.split(',').map(f => f.trim()).filter(f => f.length > 0));
        return;
      }

      if (selectedQuery.api_spec_endpoint_id) {
        const { data } = await supabase
          .from('api_endpoint_fields')
          .select('field_name')
          .eq('api_spec_endpoint_id', selectedQuery.api_spec_endpoint_id)
          .like('field_path', '[response]%')
          .order('field_name');
        if (data && data.length > 0) {
          setAvailableColumns(data.map(f => f.field_name));
          return;
        }
      }

      if (cell.id) {
        const { data: cellData } = await supabase
          .from('dashboard_cells')
          .select('last_known_columns')
          .eq('id', cell.id)
          .single();
        if (cellData?.last_known_columns && cellData.last_known_columns.length > 0) {
          setAvailableColumns(cellData.last_known_columns);
          return;
        }
      }

      setAvailableColumns([]);
    };

    fetchColumns();
  }, [selectedCellIndex, cells, queries]);

  const getRowIndices = useCallback(() => {
    const rows = new Set(cells.map(c => c.row_index));
    return Array.from(rows).sort((a, b) => a - b);
  }, [cells]);

  const getCellsInRow = useCallback((rowIndex: number) => {
    return cells
      .filter(c => c.row_index === rowIndex)
      .sort((a, b) => a.col_index - b.col_index);
  }, [cells]);

  const handleAddRow = () => {
    const rowIndices = getRowIndices();
    const currentRowCount = rowIndices.length;
    const newRowCount = currentRowCount + 1;
    const newHeightPercent = 100 / newRowCount;

    const updatedCells = cells.map(cell => ({
      ...cell,
      height_percent: newHeightPercent
    }));

    const newRowIndex = Math.max(...rowIndices, -1) + 1;

    updatedCells.push({
      query_id: null,
      title: '',
      row_index: newRowIndex,
      col_index: 0,
      row_span: 1,
      col_span: 1,
      width_percent: 100,
      height_percent: newHeightPercent,
      enable_row_selection: false,
      check_drilldown_existence: false,
      show_parameters_in_header: false,
      auto_group_by_column: null,
      auto_group_collapsed: false,
      drilldowns: []
    });

    setCells(updatedCells);
  };

  const handleSplitCell = () => {
    if (selectedCellIndex === null) return;
    const selectedCell = cells[selectedCellIndex];

    const newWidthPercent = selectedCell.width_percent / 2;
    if (newWidthPercent < MIN_CELL_PERCENT) return;

    const cellsInRow = getCellsInRow(selectedCell.row_index);
    const cellPositionInRow = cellsInRow.findIndex(c =>
      c.id === selectedCell.id ||
      (c.row_index === selectedCell.row_index && c.col_index === selectedCell.col_index)
    );

    const updatedCells = [...cells];
    updatedCells[selectedCellIndex] = {
      ...selectedCell,
      width_percent: newWidthPercent
    };

    const newColIndex = cellsInRow.length > 0
      ? Math.max(...cellsInRow.map(c => c.col_index)) + 1
      : 1;

    updatedCells.push({
      query_id: null,
      title: '',
      row_index: selectedCell.row_index,
      col_index: newColIndex,
      row_span: 1,
      col_span: 1,
      width_percent: newWidthPercent,
      height_percent: selectedCell.height_percent,
      enable_row_selection: false,
      check_drilldown_existence: false,
      show_parameters_in_header: false,
      auto_group_by_column: null,
      auto_group_collapsed: false,
      drilldowns: []
    });

    setCells(updatedCells);
    setSelectedCellIndex(updatedCells.length - 1);
  };

  const handleDeleteCell = (index: number) => {
    if (cells.length <= 1) return;

    const cellToDelete = cells[index];
    const cellsInRow = getCellsInRow(cellToDelete.row_index);

    if (cellsInRow.length === 1) {
      const rowIndices = getRowIndices();
      if (rowIndices.length <= 1) return;

      const remainingCells = cells.filter((_, i) => i !== index);
      const newRowCount = new Set(remainingCells.map(c => c.row_index)).size;
      const newHeightPercent = 100 / newRowCount;

      setCells(remainingCells.map(cell => ({
        ...cell,
        height_percent: newHeightPercent
      })));
    } else {
      const widthToDistribute = cellToDelete.width_percent / (cellsInRow.length - 1);

      const updatedCells = cells
        .filter((_, i) => i !== index)
        .map(cell => {
          if (cell.row_index === cellToDelete.row_index) {
            return {
              ...cell,
              width_percent: cell.width_percent + widthToDistribute
            };
          }
          return cell;
        });

      setCells(updatedCells);
    }

    setSelectedCellIndex(null);
  };

  const handleCellUpdate = (updates: Partial<CellConfig>) => {
    if (selectedCellIndex === null) return;
    const updatedCells = [...cells];
    updatedCells[selectedCellIndex] = { ...updatedCells[selectedCellIndex], ...updates };
    setCells(updatedCells);
  };

  const handleAddDrilldown = () => {
    if (selectedCellIndex === null) return;
    const updatedCells = [...cells];
    const cell = updatedCells[selectedCellIndex];
    cell.drilldowns.push({
      query_id: '',
      display_name: '',
      link_field: '',
      sort_order: cell.drilldowns.length,
      parameter_mappings: {}
    });
    setCells(updatedCells);
  };

  const handleUpdateDrilldown = (drilldownIndex: number, updates: Partial<DrilldownConfig>) => {
    if (selectedCellIndex === null) return;
    const updatedCells = [...cells];
    const cell = updatedCells[selectedCellIndex];
    cell.drilldowns[drilldownIndex] = { ...cell.drilldowns[drilldownIndex], ...updates };
    setCells(updatedCells);
  };

  const handleRemoveDrilldown = (drilldownIndex: number) => {
    if (selectedCellIndex === null) return;
    const updatedCells = [...cells];
    const cell = updatedCells[selectedCellIndex];
    cell.drilldowns = cell.drilldowns.filter((_, i) => i !== drilldownIndex);
    setCells(updatedCells);
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    type: 'horizontal' | 'vertical',
    rowIndex: number,
    cellIndex?: number
  ) => {
    e.preventDefault();
    setResizing({
      type,
      rowIndex,
      cellIndex,
      startX: e.clientX,
      startY: e.clientY
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();

    if (resizing.type === 'vertical') {
      const deltaY = e.clientY - resizing.startY;
      const deltaPercent = (deltaY / containerRect.height) * 100;

      const rowIndices = getRowIndices();
      const currentRowIdx = rowIndices.indexOf(resizing.rowIndex);
      if (currentRowIdx === -1 || currentRowIdx >= rowIndices.length - 1) return;

      const currentRow = resizing.rowIndex;
      const nextRow = rowIndices[currentRowIdx + 1];

      const currentRowCells = getCellsInRow(currentRow);
      const nextRowCells = getCellsInRow(nextRow);

      if (currentRowCells.length === 0 || nextRowCells.length === 0) return;

      const currentHeight = currentRowCells[0].height_percent;
      const nextHeight = nextRowCells[0].height_percent;

      const newCurrentHeight = Math.max(MIN_CELL_PERCENT, Math.min(currentHeight + nextHeight - MIN_CELL_PERCENT, currentHeight + deltaPercent));
      const newNextHeight = currentHeight + nextHeight - newCurrentHeight;

      if (newCurrentHeight < MIN_CELL_PERCENT || newNextHeight < MIN_CELL_PERCENT) return;

      setCells(prev => prev.map(cell => {
        if (cell.row_index === currentRow) {
          return { ...cell, height_percent: newCurrentHeight };
        }
        if (cell.row_index === nextRow) {
          return { ...cell, height_percent: newNextHeight };
        }
        return cell;
      }));

      setResizing(prev => prev ? { ...prev, startY: e.clientY } : null);
    } else if (resizing.type === 'horizontal' && resizing.cellIndex !== undefined) {
      const deltaX = e.clientX - resizing.startX;
      const deltaPercent = (deltaX / containerRect.width) * 100;

      const cellsInRow = getCellsInRow(resizing.rowIndex);
      if (resizing.cellIndex >= cellsInRow.length - 1) return;

      const currentCell = cellsInRow[resizing.cellIndex];
      const nextCell = cellsInRow[resizing.cellIndex + 1];

      const currentCellIndex = cells.findIndex(c =>
        c.row_index === currentCell.row_index && c.col_index === currentCell.col_index
      );
      const nextCellIndex = cells.findIndex(c =>
        c.row_index === nextCell.row_index && c.col_index === nextCell.col_index
      );

      if (currentCellIndex === -1 || nextCellIndex === -1) return;

      const currentWidth = currentCell.width_percent;
      const nextWidth = nextCell.width_percent;

      const newCurrentWidth = Math.max(MIN_CELL_PERCENT, Math.min(currentWidth + nextWidth - MIN_CELL_PERCENT, currentWidth + deltaPercent));
      const newNextWidth = currentWidth + nextWidth - newCurrentWidth;

      if (newCurrentWidth < MIN_CELL_PERCENT || newNextWidth < MIN_CELL_PERCENT) return;

      setCells(prev => {
        const updated = [...prev];
        updated[currentCellIndex] = { ...updated[currentCellIndex], width_percent: newCurrentWidth };
        updated[nextCellIndex] = { ...updated[nextCellIndex], width_percent: newNextWidth };
        return updated;
      });

      setResizing(prev => prev ? { ...prev, startX: e.clientX } : null);
    }
  }, [resizing, getRowIndices, getCellsInRow, cells]);

  const handleMouseUp = useCallback(() => {
    setResizing(null);
  }, []);

  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);

  const handleFetchColumns = async () => {
    if (selectedCellIndex === null) return;
    const cell = cells[selectedCellIndex];
    const selectedQuery = queries.find(q => q.id === cell?.query_id);
    if (!selectedQuery || !selectedQuery.api_endpoint_id) return;

    try {
      const { data: ep } = await supabase
        .from('api_endpoints')
        .select('*')
        .eq('id', selectedQuery.api_endpoint_id)
        .single();
      if (!ep) return;

      let url = ep.url;
      const subPath = selectedQuery.api_sub_path || '';
      if (subPath) {
        url = url.replace(/\/$/, '') + '/' + subPath.replace(/^\//, '');
      }

      const queryParams = selectedQuery.query_parameters as Array<{ key: string; value: string; enabled: boolean }> | null;
      const enabledParams = queryParams?.filter(p => p.enabled && p.key && p.value) || [];
      if (enabledParams.length > 0) {
        const qs = enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
        url += (url.includes('?') ? '&' : '?') + qs;
      }

      const headers: Record<string, string> = {};
      if (ep.headers && typeof ep.headers === 'object') {
        Object.entries(ep.headers as Record<string, string>).forEach(([k, v]) => { headers[k] = v; });
      }
      if (ep.auth_type === 'bearer') {
        const config = ep.auth_config as { token?: string };
        if (config?.token) headers['Authorization'] = `Bearer ${config.token}`;
      } else if (ep.auth_type === 'api_key') {
        const config = ep.auth_config as { header_name?: string; api_key?: string };
        if (config?.header_name && config?.api_key) headers[config.header_name] = config.api_key;
      }

      const response = await proxyFetch(url, { method: selectedQuery.http_method || 'GET', headers });
      const json = await response.json();
      const rows = Array.isArray(json) ? json : (json.value && Array.isArray(json.value) ? json.value : null);

      if (rows && rows.length > 0) {
        const columns = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
        setAvailableColumns(columns);
        if (cell.id) {
          supabase
            .from('dashboard_cells')
            .update({ last_known_columns: columns })
            .eq('id', cell.id)
            .then(() => {});
        }
      }
    } catch (err) {
      console.error('[DashboardBuilder] Failed to fetch columns:', err);
    }
  };

  const handleSave = async () => {
    if (saveInProgressRef.current) return;
    if (!activeCompany?.id || !user?.id || !builderProjectId) return;
    if (!dashboardName.trim()) return;

    saveInProgressRef.current = true;
    setSaving(true);

    try {
      let dashboardId = builderDashboardId || dashboard?.id;

      if (!dashboardId) {
        const { data: newDashboard, error: createError } = await supabase
          .from('dashboards')
          .insert({
            name: dashboardName,
            project_id: builderProjectId,
            company_id: activeCompany.id,
            created_by: user.id
          })
          .select()
          .single();

        if (createError) throw createError;
        dashboardId = newDashboard.id;
        setDashboard(newDashboard);
      } else {
        const { error: updateError } = await supabase
          .from('dashboards')
          .update({ name: dashboardName, updated_at: new Date().toISOString() })
          .eq('id', dashboardId);

        if (updateError) throw updateError;
      }

      const cellsToSave = cells.map((cell) => ({
        ...cell,
        id: cell.id,
        drilldowns: cell.drilldowns.filter(d => d.query_id)
      }));

      const { error: layoutError } = await saveCellsLayout(cellsToSave, dashboardId);
      if (layoutError) throw new Error(layoutError);

      await refetchProjects();
      closeBuilder();
    } catch (err) {
      console.error('Failed to save dashboard:', err);
    } finally {
      saveInProgressRef.current = false;
      setSaving(false);
    }
  };

  const rowIndices = getRowIndices();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-gray-900 dark:border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={closeBuilder}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <div>
              <input
                type="text"
                value={dashboardName}
                onChange={(e) => setDashboardName(e.target.value)}
                className="text-xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
                placeholder="Dashboard Name"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {builderDashboardId ? 'Edit Dashboard' : 'Create New Dashboard'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setConfigModalOpen(true)}
              disabled={selectedCellIndex === null}
            >
              <Settings className="w-4 h-4" />
              Configure
            </Button>
            <Button
              variant="secondary"
              onClick={() => setActionsModalOpen(true)}
              disabled={selectedCellIndex === null}
            >
              <Zap className="w-4 h-4" />
              Actions
            </Button>
            <Button variant="secondary" onClick={handleAddRow}>
              <Grid3X3 className="w-4 h-4" />
              Add Row
            </Button>
            <Button
              variant="secondary"
              onClick={handleSplitCell}
              disabled={selectedCellIndex === null || cells[selectedCellIndex]?.width_percent < MIN_CELL_PERCENT * 2}
            >
              <LayoutGrid className="w-4 h-4" />
              Split Cell
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!dashboardName.trim()}>
              <Save className="w-4 h-4" />
              Save Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 p-6 overflow-hidden"
        style={{ cursor: resizing ? (resizing.type === 'vertical' ? 'row-resize' : 'col-resize') : 'default' }}
      >
        <div className="h-full flex flex-col">
          {rowIndices.map((rowIndex, rowArrayIdx) => {
            const cellsInRow = getCellsInRow(rowIndex);
            const rowHeight = cellsInRow[0]?.height_percent ?? 100;

            return (
              <div key={rowIndex} style={{ flex: rowHeight }} className="flex flex-col min-h-0">
                <div className="flex-1 flex gap-1 min-h-0">
                  {cellsInRow.map((cell, cellIdx) => {
                    const globalIndex = cells.findIndex(c =>
                      c.row_index === cell.row_index && c.col_index === cell.col_index
                    );
                    const query = queries.find(q => q.id === cell.query_id);
                    const isSelected = selectedCellIndex === globalIndex;

                    return (
                      <div
                        key={cell.id || `${rowIndex}-${cellIdx}`}
                        className="flex h-full"
                        style={{ width: `${cell.width_percent}%` }}
                      >
                        <div
                          className={`
                            flex-1 relative rounded-lg border-2 transition-all cursor-pointer min-h-[100px]
                            ${isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                            }
                          `}
                          onClick={() => setSelectedCellIndex(globalIndex)}
                        >
                          <div className="absolute inset-0 p-4 flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                {cell.title || 'Untitled Cell'}
                              </span>
                              {cells.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCell(globalIndex);
                                  }}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              {query ? (
                                <div className="text-center">
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{query.name}</p>
                                  {cell.drilldowns.length > 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                      {cell.drilldowns.length} drilldown{cell.drilldowns.length !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400 dark:text-gray-500">
                                  Select a query
                                </p>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
                              {Math.round(cell.width_percent)}% x {Math.round(cell.height_percent)}%
                            </div>
                          </div>
                        </div>

                        {cellIdx < cellsInRow.length - 1 && (
                          <div
                            className="w-2 cursor-col-resize flex items-center justify-center group hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                            onMouseDown={(e) => handleMouseDown(e, 'horizontal', rowIndex, cellIdx)}
                          >
                            <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-500 rounded-full" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {rowArrayIdx < rowIndices.length - 1 && (
                  <div
                    className="h-2 cursor-row-resize flex items-center justify-center group hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded mx-1"
                    onMouseDown={(e) => handleMouseDown(e, 'vertical', rowIndex)}
                  >
                    <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-500 rounded-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        title="Cell Configuration"
      >
        <CellConfigPanel
          cell={selectedCellIndex !== null ? cells[selectedCellIndex] : null}
          queries={queries}
          availableColumns={availableColumns}
          onUpdate={handleCellUpdate}
          onAddDrilldown={handleAddDrilldown}
          onUpdateDrilldown={handleUpdateDrilldown}
          onRemoveDrilldown={handleRemoveDrilldown}
          onSave={() => setConfigModalOpen(false)}
          onFetchColumns={handleFetchColumns}
        />
      </Modal>

      <ActionsConfigModal
        isOpen={actionsModalOpen}
        onClose={() => setActionsModalOpen(false)}
        cellId={selectedCellIndex !== null ? cells[selectedCellIndex]?.id : undefined}
        queries={queries}
        availableColumns={availableColumns}
      />
    </div>
  );
}
