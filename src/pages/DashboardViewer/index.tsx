import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { RefreshCw, Settings, X, Maximize2, Minimize2, SlidersHorizontal, Save, Palette, Zap, Trash2, Star, Download, Mail, FileText, Loader2, Shield, ExternalLink } from 'lucide-react';
import { useActiveDashboards } from '../../contexts/ActiveDashboardsContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useDashboardConfig } from '../../hooks/useDashboardConfig';
import { useFixedValues } from '../../hooks/useFixedValues';
import { useLookupResolver } from '../../hooks/useLookupResolver';
import { useGridTemplates } from '../../hooks/useGridTemplates';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import CustomDropdown from '../../components/ui/CustomDropdown';
import DatePicker from '../../components/ui/DatePicker';
import ActionToast, { ActionToastData } from '../../components/ui/ActionToast';
import DashboardCell, { DashboardCellRef } from './DashboardCell';
import SaveTemplateModal from './SaveTemplateModal';
import GridFormattingModal, { DrilldownDefinition } from './GridFormattingModal';
import EmailCsvModal from './EmailCsvModal';
import PopupActionModal from './PopupActionModal';
import DashboardAccessModal from './DashboardAccessModal';
import { executeLinkAction, getPromptMappings } from './actionExecutor';
import { useCellActions } from '../../hooks/useCellActions';
import { logActivity } from '../../lib/activityLog';
import type { UserParameter, FixedValue, FixedValueListItem, GridTemplate, GridTemplateColumnConfig, GridFormattingRules, GridTemplateCellColumnConfig, GridCellFormattingRules, DashboardCellActionWithQuery, ActionVisibilityCondition } from '../../types/database';
import { evaluateVisibilityCondition } from '../../types/database';

export default function DashboardViewer() {
  const { isAdmin, hasPermission, activeCompany, user } = useAuth();
  const {
    openDashboards,
    activeDashboardId,
    setActiveDashboard,
    closeDashboard,
    openBuilder
  } = useActiveDashboards();

  const activeDashboard = openDashboards.find(d => d.dashboard.id === activeDashboardId);
  const { cells, loading, refetch } = useDashboardConfig(activeDashboardId);
  const { fixedValues } = useFixedValues();
  const { resolveLookup, getLookupState } = useLookupResolver();
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshMinutes, setAutoRefreshMinutes] = useState<number>(
    activeDashboard?.dashboard.auto_refresh_minutes || 0
  );
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [cellRecordCounts, setCellRecordCounts] = useState<Record<string, number>>({});
  const [fullscreenCellId, setFullscreenCellId] = useState<string | null>(null);
  const [showParamModal, setShowParamModal] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [requiredParameters, setRequiredParameters] = useState<UserParameter[]>([]);
  const [parametersReady, setParametersReady] = useState(false);
  const [fixedValueMap, setFixedValueMap] = useState<Record<string, FixedValue>>({});
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [cellParameterValues, setCellParameterValues] = useState<Record<string, Record<string, string>>>({});
  const [pendingCellParamValues, setPendingCellParamValues] = useState<Record<string, string>>({});
  const [pendingGlobalParamValues, setPendingGlobalParamValues] = useState<Record<string, string>>({});
  const initialParamsSetRef = useRef<string | null>(null);
  const submittedDashboardParamsRef = useRef<Record<string, Record<string, string>>>({});
  const [parameterHistory, setParameterHistory] = useState<Record<string, string>[]>([]);

  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [hasColumnChanges, setHasColumnChanges] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsTargetCellId, setSaveAsTargetCellId] = useState<string | null>(null);
  const [showFormattingModal, setShowFormattingModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [formattingCellId, setFormattingCellId] = useState<string | null>(null);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState(false);
  const [cellColumns, setCellColumns] = useState<Record<string, string[]>>({});
  const [drilldownColumns, setDrilldownColumns] = useState<Record<string, Record<string, string[]>>>({});
  const [buttonActions, setButtonActions] = useState<Record<string, DashboardCellActionWithQuery[]>>({});
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [actionProgress, setActionProgress] = useState<{ name: string; current: number; total: number } | null>(null);
  const [actionToasts, setActionToasts] = useState<ActionToastData[]>([]);
  const [exportDropdownCellId, setExportDropdownCellId] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [popupModal, setPopupModal] = useState<{ title: string; template: string; rowData: Record<string, unknown> } | null>(null);
  const [emailCsvContent, setEmailCsvContent] = useState('');
  const [emailFilename, setEmailFilename] = useState('');
  const [emailCellTitle, setEmailCellTitle] = useState('');
  const cellRefs = useRef<Record<string, DashboardCellRef | null>>({});
  const userClearedTemplateRef = useRef(false);
  const { fetchActionsForCell } = useCellActions();

  const firstCellId = cells.length > 0 ? cells[0].id : null;
  const currentCellId = fullscreenCellId || activeCellId || firstCellId;

  const {
    templates,
    loading: templatesLoading,
    createTemplate,
    updateTemplate,
    updateFormattingRules,
    deleteTemplate,
    setDefaultTemplate,
    getDefaultTemplate
  } = useGridTemplates(activeDashboardId ?? null);

  useEffect(() => {
    if (!exportDropdownCellId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-export-dropdown]')) {
        setExportDropdownCellId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportDropdownCellId]);

  useEffect(() => {
    console.log('[DashboardViewer] Template Debug:', {
      activeDashboardId,
      templatesCount: templates.length,
      templates: templates.map(t => ({ id: t.id, name: t.name, is_default: t.is_default })),
      templatesLoading,
      selectedTemplateId,
      cellsCount: cells.length,
      cellIds: cells.map(c => c.id)
    });
  }, [activeDashboardId, templates, templatesLoading, selectedTemplateId, cells]);

  useEffect(() => {
    if (!templatesLoading && templates.length > 0 && !selectedTemplateId && !userClearedTemplateRef.current) {
      const defaultTemplate = getDefaultTemplate();
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      }
    }
  }, [templates, templatesLoading, selectedTemplateId, getDefaultTemplate]);

  useEffect(() => {
    console.log('[DashboardViewer] RESET EFFECT triggered - activeDashboardId changed to:', activeDashboardId);
    console.log('[DashboardViewer] RESET EFFECT - cells at this moment:', cells.length, 'cell IDs:', cells.map(c => c.id));
    console.log('[DashboardViewer] RESET EFFECT - loading state:', loading);
    setSelectedTemplateId(null);
    setHasColumnChanges(false);
    setParameterValues({});
    setPendingGlobalParamValues({});
    setCellParameterValues({});
    setRequiredParameters([]);
    setParametersReady(false);
    initialParamsSetRef.current = null;
    userClearedTemplateRef.current = false;
    console.log('[DashboardViewer] RESET EFFECT - cleared all parameter state, ref set to null');
  }, [activeDashboardId]);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return templates.find(t => t.id === selectedTemplateId) || null;
  }, [selectedTemplateId, templates]);

  const getActiveTemplateForCell = useCallback((cellId: string): GridTemplateCellColumnConfig | null => {
    if (!selectedTemplate?.column_config?.cells) return null;
    return selectedTemplate.column_config.cells[cellId] || null;
  }, [selectedTemplate]);

  const handleColumnChange = useCallback(() => {
    setHasColumnChanges(true);
  }, []);

  const collectAllCellConfigs = useCallback((): GridTemplateColumnConfig => {
    const cellConfigs: Record<string, GridTemplateCellColumnConfig> = {};
    cells.forEach(cell => {
      const ref = cellRefs.current[cell.id];
      if (ref) {
        cellConfigs[cell.id] = ref.getColumnConfig();
      }
    });
    return { cells: cellConfigs };
  }, [cells]);

  const collectAllFormattingRules = useCallback((): GridFormattingRules => {
    if (!selectedTemplate?.formatting_rules?.cells) {
      return { cells: {} };
    }
    return selectedTemplate.formatting_rules;
  }, [selectedTemplate]);

  const handleSave = useCallback(async () => {
    if (cells.length === 0) return;

    console.log('[handleSave] Starting save...');
    const columnConfig = collectAllCellConfigs();
    console.log('[handleSave] columnConfig:', JSON.stringify(columnConfig, null, 2));

    Object.entries(columnConfig.cells || {}).forEach(([cellId, cellConfig]) => {
      if (cellConfig.drilldowns) {
        console.log('[handleSave] Cell', cellId, 'drilldowns:', JSON.stringify(cellConfig.drilldowns, null, 2));
      }
    });

    const formattingRules = collectAllFormattingRules();

    if (selectedTemplateId) {
      console.log('[handleSave] Updating template:', selectedTemplateId);
      await updateTemplate(selectedTemplateId, columnConfig, formattingRules);
      console.log('[handleSave] Template updated');
    } else {
      await createTemplate('Default', columnConfig, formattingRules, true);
    }

    setHasColumnChanges(false);
  }, [cells, selectedTemplateId, updateTemplate, createTemplate, collectAllCellConfigs, collectAllFormattingRules]);

  const handleSaveAs = useCallback((name: string) => {
    if (cells.length === 0) return;

    const columnConfig = collectAllCellConfigs();
    const formattingRules = collectAllFormattingRules();

    createTemplate(name, columnConfig, formattingRules, false).then(newTemplate => {
      if (newTemplate) {
        setSelectedTemplateId(newTemplate.id);
        setHasColumnChanges(false);
      }
    });

    setShowSaveAsModal(false);
    setSaveAsTargetCellId(null);
  }, [cells, createTemplate, collectAllCellConfigs, collectAllFormattingRules]);

  const handleTemplateChange = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId || null);
    setHasColumnChanges(false);
    userClearedTemplateRef.current = !templateId;
  }, []);

  const handleOpenFormatting = useCallback((cellId: string, columns: string[]) => {
    setCellColumns(prev => ({ ...prev, [cellId]: columns }));
    setFormattingCellId(cellId);
    setShowFormattingModal(true);
  }, []);

  const handleColumnsDetected = useCallback((cellId: string, columns: string[]) => {
    setCellColumns(prev => ({ ...prev, [cellId]: columns }));
  }, []);

  const handleDrilldownColumnsDetected = useCallback((cellId: string, drilldownId: string, columns: string[]) => {
    setDrilldownColumns(prev => ({
      ...prev,
      [cellId]: {
        ...(prev[cellId] || {}),
        [drilldownId]: columns
      }
    }));
  }, []);

  useEffect(() => {
    const loadButtonActions = async () => {
      const actionMap: Record<string, DashboardCellActionWithQuery[]> = {};
      for (const c of cells) {
        const actions = await fetchActionsForCell(c.id);
        const buttons = actions.filter(a => a.display_mode === 'button' || a.display_mode === 'both');
        if (buttons.length > 0) {
          actionMap[c.id] = buttons;
        }
      }
      setButtonActions(actionMap);
    };
    if (cells.length > 0) {
      loadButtonActions();
    }
  }, [cells, fetchActionsForCell]);

  const addToast = useCallback((toast: Omit<ActionToastData, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setActionToasts(prev => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<ActionToastData>) => {
    setActionToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setActionToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleActionComplete = useCallback((actionName: string, result: { success: number; failed: number; pulseTriggered?: number; errors?: string[] }) => {
    console.log('[DashboardViewer] handleActionComplete:', actionName, JSON.stringify(result), 'activeCompany:', activeCompany?.id);
    if (result.failed === 0) {
      const pulseNote = result.pulseTriggered ? ' Pulse triggered.' : '';
      addToast({
        type: 'success',
        message: `${actionName} completed`,
        detail: result.success === 1
          ? `1 row processed successfully.${pulseNote}`
          : `${result.success} rows processed successfully.${pulseNote}`,
      });
      if (activeCompany) {
        logActivity('action_execute', activeCompany.id, actionName, activeDashboardId || undefined, { rows: result.success });
        if (result.pulseTriggered && result.pulseTriggered > 0) {
          logActivity('pulse_trigger', activeCompany.id, actionName, activeDashboardId || undefined, { triggered_count: result.pulseTriggered, source: 'cell_action' });
        }
      }
    } else {
      addToast({
        type: 'error',
        message: `${actionName} had failures`,
        detail: `${result.success} succeeded, ${result.failed} failed.`,
      });
      if (activeCompany) {
        logActivity('action_failed', activeCompany.id, actionName, activeDashboardId || undefined, {
          success: result.success,
          failed: result.failed,
          errors: result.errors || [],
        });
      }
    }
  }, [addToast, activeCompany, activeDashboardId]);

  const handleExecuteButtonAction = useCallback(async (cellId: string, action: DashboardCellActionWithQuery) => {
    const cellRef = cellRefs.current[cellId];
    if (!cellRef) return;

    const condition = action.visibility_condition as ActionVisibilityCondition | null;
    if (condition && condition.field) {
      const selectedRows = cellRef.getSelectedRowsData();
      if (selectedRows.length > 0) {
        const failedRows = selectedRows.filter(row => !evaluateVisibilityCondition(condition, row));
        if (failedRows.length > 0) {
          addToast({
            type: 'error',
            message: `Cannot run "${action.display_name}"`,
            detail: `${failedRows.length} selected row${failedRows.length > 1 ? 's' : ''} ${failedRows.length > 1 ? 'do' : 'does'} not meet the visibility condition (${condition.field} ${condition.operator.replace(/_/g, ' ')}).`,
          });
          return;
        }
      }
    }

    setExecutingAction(action.id);
    setActionProgress({ name: action.display_name, current: 0, total: 1 });
    const toastId = addToast({
      type: 'progress',
      message: `Running "${action.display_name}"...`,
      progress: { current: 0, total: 1 },
    });

    try {
      const result = await cellRef.executeActionOnSelectedRows(action, (current, total) => {
        setActionProgress({ name: action.display_name, current, total });
        updateToast(toastId, {
          progress: { current, total },
          message: `Running "${action.display_name}"...`,
        });
      });

      console.log('[DashboardViewer] Action result:', action.display_name, JSON.stringify(result));

      if (result.success === 0 && result.failed === 0) {
        updateToast(toastId, {
          type: 'error',
          message: 'No rows selected',
          detail: 'Select rows using checkboxes before running this action.',
          progress: undefined,
        });
      } else if (result.failed === 0) {
        const pulseNote = result.pulseTriggered ? ' Pulse triggered.' : '';
        updateToast(toastId, {
          type: 'success',
          message: `${action.display_name} completed`,
          detail: result.success === 1
            ? `1 row processed successfully.${pulseNote}`
            : `${result.success} rows processed successfully.${pulseNote}`,
          progress: undefined,
        });
        if (activeCompany) {
          logActivity('action_execute', activeCompany.id, action.display_name, activeDashboardId || undefined, { rows: result.success });
          if (result.pulseTriggered && result.pulseTriggered > 0) {
            logActivity('pulse_trigger', activeCompany.id, action.display_name, activeDashboardId || undefined, { triggered_count: result.pulseTriggered, source: 'cell_action' });
          }
        }
      } else {
        updateToast(toastId, {
          type: 'error',
          message: `${action.display_name} had failures`,
          detail: `${result.success} succeeded, ${result.failed} failed.`,
          progress: undefined,
        });
        if (activeCompany) {
          logActivity('action_failed', activeCompany.id, action.display_name, activeDashboardId || undefined, {
            success: result.success,
            failed: result.failed,
            errors: result.errors || [],
          });
        }
      }
    } catch (err) {
      updateToast(toastId, {
        type: 'error',
        message: `${action.display_name} failed`,
        detail: err instanceof Error ? err.message : 'An unexpected error occurred.',
        progress: undefined,
      });
      if (activeCompany) {
        logActivity('action_failed', activeCompany.id, action.display_name, activeDashboardId || undefined, {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    } finally {
      setExecutingAction(null);
      setActionProgress(null);
    }
  }, [addToast, updateToast, activeCompany, activeDashboardId]);

  const handlePopupAction = useCallback((title: string, template: string, rowData: Record<string, unknown>) => {
    setPopupModal({ title, template, rowData });
    if (activeCompany) {
      logActivity('action_execute', activeCompany.id, title, activeDashboardId || undefined, { type: 'popup' });
    }
  }, [activeCompany, activeDashboardId]);

  const handlePopupButtonAction = useCallback((cellId: string, action: DashboardCellActionWithQuery) => {
    const cellRef = cellRefs.current[cellId];
    if (!cellRef) return;

    const condition = action.visibility_condition as ActionVisibilityCondition | null;
    if (condition && condition.field) {
      const selectedRows = cellRef.getSelectedRowsData();
      if (selectedRows.length > 0) {
        const failedRows = selectedRows.filter(row => !evaluateVisibilityCondition(condition, row));
        if (failedRows.length > 0) {
          addToast({
            type: 'error',
            message: `Cannot run "${action.display_name}"`,
            detail: `${failedRows.length} selected row${failedRows.length > 1 ? 's' : ''} ${failedRows.length > 1 ? 'do' : 'does'} not meet the visibility condition (${condition.field} ${condition.operator.replace(/_/g, ' ')}).`,
          });
          return;
        }
      }
    }

    const rowData = cellRef.getSelectedRowData();
    if (!rowData) {
      addToast({
        type: 'error',
        message: 'Select a single row',
        detail: 'Popup actions work on a single row. Select exactly one row using the checkbox.',
      });
      return;
    }

    const template = (typeof action.popup_template === 'string' ? action.popup_template : '') || '';
    setPopupModal({ title: action.display_name, template, rowData });
    if (activeCompany) {
      logActivity('action_execute', activeCompany.id, action.display_name, activeDashboardId || undefined, { type: 'popup' });
    }
  }, [addToast, activeCompany, activeDashboardId]);

  const handleLinkButtonAction = useCallback((cellId: string, action: DashboardCellActionWithQuery) => {
    const cellRef = cellRefs.current[cellId];
    if (!cellRef) return;

    const condition = action.visibility_condition as ActionVisibilityCondition | null;
    if (condition && condition.field) {
      const selectedRows = cellRef.getSelectedRowsData();
      if (selectedRows.length > 0) {
        const failedRows = selectedRows.filter(row => !evaluateVisibilityCondition(condition, row));
        if (failedRows.length > 0) {
          addToast({
            type: 'error',
            message: `Cannot run "${action.display_name}"`,
            detail: `${failedRows.length} selected row${failedRows.length > 1 ? 's' : ''} ${failedRows.length > 1 ? 'do' : 'does'} not meet the visibility condition (${condition.field} ${condition.operator.replace(/_/g, ' ')}).`,
          });
          return;
        }
      }
    }

    const rowData = cellRef.getSelectedRowData();
    if (!rowData) {
      addToast({
        type: 'error',
        message: 'Select a single row',
        detail: 'Link actions work on a single row. Select exactly one row using the checkbox.',
      });
      return;
    }

    const prompts = getPromptMappings(action);
    if (prompts.length > 0) {
      const values = Object.fromEntries(prompts.map(p => [p.parameterName, '']));
      const promptText = prompts.map(p => p.promptText || p.parameterName).join(', ');
      const userInput = window.prompt(promptText);
      if (userInput === null) return;
      if (prompts.length === 1) {
        values[prompts[0].parameterName] = userInput;
      }
      executeLinkAction(action, rowData, values);
      return;
    }

    executeLinkAction(action, rowData);
    if (activeCompany) {
      logActivity('action_execute', activeCompany.id, action.display_name, activeDashboardId || undefined, { type: 'link' });
    }
  }, [addToast, activeCompany, activeDashboardId]);

  const getDrilldownDefinitions = useCallback((cellId: string): DrilldownDefinition[] => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell?.drilldowns) return [];

    return cell.drilldowns.map(d => ({
      id: d.id,
      displayName: d.display_name,
      columns: drilldownColumns[cellId]?.[d.id] || []
    }));
  }, [cells, drilldownColumns]);

  const handleSaveFormatting = useCallback(async (cellRules: GridCellFormattingRules) => {
    if (!formattingCellId) return;

    const currentRules = selectedTemplate?.formatting_rules || { cells: {} };
    const updatedRules: GridFormattingRules = {
      cells: {
        ...currentRules.cells,
        [formattingCellId]: cellRules
      }
    };

    if (selectedTemplateId) {
      await updateFormattingRules(selectedTemplateId, updatedRules);
    } else {
      const columnConfig = collectAllCellConfigs();
      const newTemplate = await createTemplate('Default', columnConfig, updatedRules, true);
      if (newTemplate) {
        setSelectedTemplateId(newTemplate.id);
      }
    }
  }, [formattingCellId, selectedTemplateId, selectedTemplate, updateFormattingRules, createTemplate, collectAllCellConfigs]);

  const getActiveFormattingRules = useCallback((): GridCellFormattingRules => {
    if (!formattingCellId || !selectedTemplate?.formatting_rules?.cells) return {};
    return selectedTemplate.formatting_rules.cells[formattingCellId] || {};
  }, [formattingCellId, selectedTemplate]);

  const getFormattingRulesForCell = useCallback((cellId: string): GridCellFormattingRules => {
    if (!selectedTemplate?.formatting_rules?.cells) return {};
    return selectedTemplate.formatting_rules.cells[cellId] || {};
  }, [selectedTemplate]);

  const handleGroupByChange = useCallback(async (cellId: string, groupBy: string[]) => {
    if (!selectedTemplateId) return;
    const currentRules = selectedTemplate?.formatting_rules || { cells: {} };
    const cellRules = currentRules.cells?.[cellId] || {};
    const updatedCellRules: GridCellFormattingRules = {
      ...cellRules,
      groupBy: groupBy.length > 0 ? groupBy : undefined
    };
    const updatedRules: GridFormattingRules = {
      cells: {
        ...currentRules.cells,
        [cellId]: updatedCellRules
      }
    };
    await updateFormattingRules(selectedTemplateId, updatedRules);
  }, [selectedTemplateId, selectedTemplate, updateFormattingRules]);

  console.log('[DashboardViewer] Render state:', {
    activeDashboardId,
    activeDashboard: activeDashboard?.dashboard?.name,
    cellsCount: cells.length,
    loading
  });

  useEffect(() => {
    console.log('[DashboardViewer] PARAM EFFECT triggered');
    console.log('[DashboardViewer] PARAM EFFECT - activeDashboardId:', activeDashboardId);
    console.log('[DashboardViewer] PARAM EFFECT - loading:', loading);
    console.log('[DashboardViewer] PARAM EFFECT - cells.length:', cells.length);
    console.log('[DashboardViewer] PARAM EFFECT - cell IDs:', cells.map(c => c.id));
    console.log('[DashboardViewer] PARAM EFFECT - cell dashboard_ids:', cells.map(c => c.dashboard_id));
    console.log('[DashboardViewer] PARAM EFFECT - initialParamsSetRef.current:', initialParamsSetRef.current);

    if (loading || cells.length === 0) {
      console.log('[DashboardViewer] PARAM EFFECT - EARLY RETURN: loading or no cells');
      return;
    }
    if (initialParamsSetRef.current === activeDashboardId) {
      console.log('[DashboardViewer] PARAM EFFECT - EARLY RETURN: ref matches activeDashboardId');
      return;
    }

    const cellsBelongToCurrentDashboard = cells.every(cell => cell.dashboard_id === activeDashboardId);
    if (!cellsBelongToCurrentDashboard) {
      console.log('[DashboardViewer] PARAM EFFECT - EARLY RETURN: cells belong to different dashboard (stale data)');
      return;
    }

    console.log('[DashboardViewer] PARAM EFFECT - PROCEEDING to extract parameters from cells');

    const allParams: UserParameter[] = [];
    const seenNames = new Set<string>();

    cells.forEach(cell => {
      const query = cell.queries;
      console.log('[DashboardViewer] PARAM EFFECT - Processing cell:', cell.id, 'dashboard_id:', cell.dashboard_id, 'query:', query?.name);
      if (query?.user_parameters) {
        const params = query.user_parameters as UserParameter[];
        console.log('[DashboardViewer] PARAM EFFECT - Cell', cell.id, 'has params:', params.map(p => p.name));
        params.forEach(p => {
          if (!seenNames.has(p.name)) {
            seenNames.add(p.name);
            allParams.push(p);
          }
        });
      }
    });

    console.log('[DashboardViewer] PARAM EFFECT - Extracted params:', allParams.map(p => p.name));

    const fvMap: Record<string, FixedValue> = {};
    const defaultValues: Record<string, string> = {};

    allParams.forEach(p => {
      const fvId = p.fixedValueId || fixedValues.find(fv => fv.id === p.dataType)?.id;
      if (fvId) {
        const fv = fixedValues.find(v => v.id === fvId);
        if (fv) {
          fvMap[fvId] = fv;
          if (fv.default_value) {
            defaultValues[p.name] = fv.default_value;
          } else if (!fv.is_list && fv.single_value) {
            defaultValues[p.name] = fv.single_value;
          }
        }
      }
    });

    setFixedValueMap(fvMap);
    setRequiredParameters(allParams);

    Object.values(fvMap).forEach(fv => {
      if (fv.value_type === 'lookup') {
        resolveLookup(fv);
      }
    });

    console.log('[DashboardViewer] PARAM EFFECT - Setting initialParamsSetRef.current to:', activeDashboardId);
    initialParamsSetRef.current = activeDashboardId ?? null;

    const previouslySubmittedParams = activeDashboardId ? submittedDashboardParamsRef.current[activeDashboardId] : null;

    if (previouslySubmittedParams && allParams.length > 0) {
      console.log('[DashboardViewer] PARAM EFFECT - Restoring previously submitted params for dashboard:', activeDashboardId);
      setParameterValues(previouslySubmittedParams);
      setPendingGlobalParamValues(previouslySubmittedParams);
      setParametersReady(true);
    } else if (allParams.length > 0) {
      console.log('[DashboardViewer] PARAM EFFECT - Showing param modal, params found:', allParams.length);
      setParameterValues(defaultValues);
      setPendingGlobalParamValues(defaultValues);
      setShowParamModal(true);
      setParametersReady(false);
      if (activeDashboardId) fetchParameterHistory(activeDashboardId);
    } else {
      console.log('[DashboardViewer] PARAM EFFECT - No params, setting parametersReady=true');
      setParametersReady(true);
    }
  }, [cells, loading, activeDashboardId, fixedValues, resolveLookup]);

  const handleParamChange = (paramName: string, value: string) => {
    setPendingGlobalParamValues(prev => ({ ...prev, [paramName]: value }));
  };

  const fetchParameterHistory = useCallback(async (dashboardId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('dashboard_parameter_history')
      .select('parameter_values')
      .eq('dashboard_id', dashboardId)
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })
      .limit(3);
    if (data) {
      setParameterHistory(data.map(r => r.parameter_values as Record<string, string>));
    }
  }, [user]);

  const saveParameterHistory = useCallback(async (dashboardId: string, values: Record<string, string>) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('dashboard_parameter_history')
      .select('id, parameter_values')
      .eq('dashboard_id', dashboardId)
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })
      .limit(10);
    const match = existing?.find(r =>
      JSON.stringify(r.parameter_values) === JSON.stringify(values)
    );
    if (match) {
      await supabase
        .from('dashboard_parameter_history')
        .update({ used_at: new Date().toISOString() })
        .eq('id', match.id);
    } else {
      await supabase
        .from('dashboard_parameter_history')
        .insert({ dashboard_id: dashboardId, user_id: user.id, parameter_values: values });
      if (existing && existing.length >= 10) {
        const oldest = existing[existing.length - 1];
        await supabase
          .from('dashboard_parameter_history')
          .delete()
          .eq('id', oldest.id);
      }
    }
  }, [user]);

  const handleParamSubmit = () => {
    setParameterValues(pendingGlobalParamValues);
    setShowParamModal(false);
    setParametersReady(true);
    initialParamsSetRef.current = activeDashboardId ?? null;
    if (activeDashboardId) {
      submittedDashboardParamsRef.current[activeDashboardId] = { ...pendingGlobalParamValues };
      saveParameterHistory(activeDashboardId, pendingGlobalParamValues);
    }
  };

  const validateParameterValue = (param: UserParameter, value: string): boolean => {
    const fvId = param.fixedValueId || (fixedValueMap[param.dataType] ? param.dataType : undefined);
    if (fvId) {
      const fixedValue = fixedValueMap[fvId];
      if (fixedValue && !fixedValue.is_list && fixedValue.single_value) {
        return true;
      }
    }
    if (!value.trim()) return false;
    switch (param.dataType) {
      case 'Integer':
      case 'Integer (Fixed)':
        return /^-?\d+$/.test(value);
      case 'Double':
      case 'Non-Integer (Fixed)':
        return /^-?\d*\.?\d+$/.test(value);
      case 'Boolean':
        return value.toLowerCase() === 'true' || value.toLowerCase() === 'false';
      default:
        return true;
    }
  };

  const allParamsValid = requiredParameters.every(p =>
    validateParameterValue(p, pendingGlobalParamValues[p.name] || '')
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    const refreshPromises = cells.map(cell => {
      const ref = cellRefs.current[cell.id];
      if (ref?.refreshData) return ref.refreshData();
      return Promise.resolve();
    });
    await Promise.all(refreshPromises);
    setLastRefreshTime(new Date());
    setRefreshing(false);
  };

  useEffect(() => {
    if (autoRefreshMinutes <= 0) return;
    const intervalMs = autoRefreshMinutes * 60 * 1000;
    const id = setInterval(() => {
      const refreshPromises = cells.map(cell => {
        const ref = cellRefs.current[cell.id];
        if (ref?.refreshData) return ref.refreshData();
        return Promise.resolve();
      });
      Promise.all(refreshPromises).then(() => setLastRefreshTime(new Date()));
    }, intervalMs);
    return () => clearInterval(id);
  }, [autoRefreshMinutes, cells]);

  useEffect(() => {
    setAutoRefreshMinutes(activeDashboard?.dashboard.auto_refresh_minutes || 0);
  }, [activeDashboardId]);

  const handleAutoRefreshChange = async (val: string) => {
    const minutes = Number(val);
    setAutoRefreshMinutes(minutes);
    if (activeDashboardId) {
      await supabase
        .from('dashboards')
        .update({ auto_refresh_minutes: minutes || null })
        .eq('id', activeDashboardId);
    }
  };

  const handleEditAllParameters = () => {
    if (requiredParameters.length > 0) {
      setPendingGlobalParamValues({ ...parameterValues });
      setShowParamModal(true);
      if (activeDashboardId) fetchParameterHistory(activeDashboardId);
    }
  };

  const getCellParameters = useCallback((cellId: string): UserParameter[] => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell?.queries?.user_parameters) return [];
    return cell.queries.user_parameters as UserParameter[];
  }, [cells]);

  const cellHasParameters = useCallback((cellId: string): boolean => {
    return getCellParameters(cellId).length > 0;
  }, [getCellParameters]);

  const handleCellParamChange = (paramName: string, value: string) => {
    setPendingCellParamValues(prev => ({ ...prev, [paramName]: value }));
  };

  const openCellParamModal = (cellId: string) => {
    const currentValues = { ...parameterValues, ...(cellParameterValues[cellId] || {}) };
    setPendingCellParamValues(currentValues);
    setEditingCellId(cellId);
  };

  const handleCellParamSubmit = () => {
    if (editingCellId) {
      setCellParameterValues(prev => ({
        ...prev,
        [editingCellId]: { ...pendingCellParamValues }
      }));
    }
    setEditingCellId(null);
  };

  const getEffectiveParamsForCell = useCallback((cellId: string): Record<string, string> => {
    return { ...parameterValues, ...(cellParameterValues[cellId] || {}) };
  }, [parameterValues, cellParameterValues]);

  const getParamDisplayLabel = useCallback((param: UserParameter, value: string): string => {
    if (!value) return '';
    const fvId = param.fixedValueId || (fixedValueMap[param.dataType] ? param.dataType : undefined);
    if (fvId) {
      const fixedValue = fixedValueMap[fvId];
      if (fixedValue?.is_list && fixedValue.list_values) {
        const listItems = fixedValue.list_values as FixedValueListItem[];
        const match = listItems.find(item => item.value === value);
        if (match) return match.description ? `${match.value} - ${match.description}` : match.value;
      }
    }
    return value;
  }, [fixedValueMap]);

  const getCellParamSummary = useCallback((cellId: string): string => {
    const params = getCellParameters(cellId);
    if (!params.length) return '';
    const effectiveValues = getEffectiveParamsForCell(cellId);
    return params
      .map(p => getParamDisplayLabel(p, effectiveValues[p.name] || ''))
      .filter(Boolean)
      .join(' | ');
  }, [getCellParameters, getEffectiveParamsForCell, getParamDisplayLabel]);

  const editingCellParams = editingCellId ? getCellParameters(editingCellId) : [];
  const editingCellValues = pendingCellParamValues;
  const editingCellAllParamsValid = editingCellParams.every(p =>
    validateParameterValue(p, editingCellValues[p.name] || '')
  );
  const editingCell = editingCellId ? cells.find(c => c.id === editingCellId) : null;

  const renderCellParamInput = (param: UserParameter) => {
    const value = editingCellValues[param.name] || '';
    const baseClass = "w-full h-9 px-3 text-sm bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-white rounded-lg shadow-sm transition-all hover:border-slate-300 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    const fvId = param.fixedValueId || (fixedValueMap[param.dataType] ? param.dataType : undefined);
    if (fvId) {
      const fixedValue = fixedValueMap[fvId];
      if (fixedValue) {
        if (fixedValue.is_list && fixedValue.list_values && fixedValue.list_values.length > 0) {
          const listItems = fixedValue.list_values as FixedValueListItem[];
          const options = listItems.map((item) => ({
            value: item.value,
            label: item.description ? `${item.value} - ${item.description}` : item.value,
          }));
          return (
            <CustomDropdown
              value={value}
              onChange={(v) => handleCellParamChange(param.name, v)}
              options={options}
              placeholder="Select an option..."
            />
          );
        } else if (!fixedValue.is_list && fixedValue.single_value) {
          return (
            <input
              type="text"
              value={fixedValue.single_value}
              readOnly
              className={`${baseClass} bg-slate-50 dark:bg-gray-600 cursor-not-allowed`}
            />
          );
        }
      }
    }

    switch (param.dataType) {
      case 'Date':
      case 'Date (Fixed)':
        return (
          <DatePicker
            value={value}
            onChange={(v) => handleCellParamChange(param.name, v)}
            placeholder="Select date"
          />
        );
      case 'Integer':
      case 'Integer (Fixed)':
        return (
          <input
            type="number"
            step="1"
            value={value}
            onChange={(e) => handleCellParamChange(param.name, e.target.value)}
            className={baseClass}
            placeholder="Enter a whole number"
          />
        );
      case 'Double':
      case 'Non-Integer (Fixed)':
        return (
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => handleCellParamChange(param.name, e.target.value)}
            className={baseClass}
            placeholder="Enter a number"
          />
        );
      case 'Boolean':
        return (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`cell-${param.name}`}
                checked={value.toLowerCase() === 'true'}
                onChange={() => handleCellParamChange(param.name, 'true')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`cell-${param.name}`}
                checked={value.toLowerCase() === 'false'}
                onChange={() => handleCellParamChange(param.name, 'false')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
            </label>
          </div>
        );
      case 'DateTime (Fixed)':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => handleCellParamChange(param.name, e.target.value)}
            className={baseClass}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleCellParamChange(param.name, e.target.value)}
            className={baseClass}
            placeholder="Enter text"
          />
        );
    }
  };

  const handleEdit = () => {
    if (activeDashboard) {
      openBuilder(activeDashboard.dashboard.project_id, activeDashboard.dashboard.id);
    }
  };

  const getRowIndices = useCallback(() => {
    const rows = new Set(cells.map(c => c.row_index));
    return Array.from(rows).sort((a, b) => a - b);
  }, [cells]);

  const getCellsInRow = useCallback((rowIndex: number) => {
    return cells
      .filter(c => c.row_index === rowIndex)
      .sort((a, b) => a.col_index - b.col_index);
  }, [cells]);

  const rowIndices = useMemo(() => getRowIndices(), [getRowIndices]);

  const handleRecordCount = useCallback((cellId: string, count: number) => {
    setCellRecordCounts(prev => ({ ...prev, [cellId]: count }));
  }, []);

  if (!activeDashboard) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">No dashboard selected</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Click on a dashboard in the sidebar to view it
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 dark:border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderParamInput = (param: UserParameter) => {
    const value = pendingGlobalParamValues[param.name] || '';
    const baseClass = "w-full h-9 px-3 text-sm bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-white rounded-lg shadow-sm transition-all hover:border-slate-300 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    const fvId = param.fixedValueId || (fixedValueMap[param.dataType] ? param.dataType : undefined);
    if (fvId) {
      const fixedValue = fixedValueMap[fvId];
      if (fixedValue) {
        if (fixedValue.value_type === 'lookup') {
          const lookupState = getLookupState(fixedValue.id);
          if (lookupState.loading) {
            return (
              <div className="flex items-center gap-2 h-9 px-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading options...
              </div>
            );
          }
          if (lookupState.error) {
            return (
              <div className="flex items-center gap-2 h-9 px-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                Failed to load: {lookupState.error}
              </div>
            );
          }
          if (lookupState.options.length > 0) {
            return (
              <CustomDropdown
                value={value}
                onChange={(v) => handleParamChange(param.name, v)}
                options={lookupState.options}
                placeholder="Select an option..."
              />
            );
          }
        } else if (fixedValue.is_list && fixedValue.list_values && fixedValue.list_values.length > 0) {
          const listItems = fixedValue.list_values as FixedValueListItem[];
          const options = listItems.map((item) => ({
            value: item.value,
            label: item.description ? `${item.value} - ${item.description}` : item.value,
          }));
          return (
            <CustomDropdown
              value={value}
              onChange={(v) => handleParamChange(param.name, v)}
              options={options}
              placeholder="Select an option..."
            />
          );
        } else if (!fixedValue.is_list && fixedValue.single_value) {
          return (
            <input
              type="text"
              value={fixedValue.single_value}
              readOnly
              className={`${baseClass} bg-slate-50 dark:bg-gray-600 cursor-not-allowed`}
            />
          );
        }
      }
    }

    switch (param.dataType) {
      case 'Date':
      case 'Date (Fixed)':
        return (
          <DatePicker
            value={value}
            onChange={(v) => handleParamChange(param.name, v)}
            placeholder="Select date"
          />
        );
      case 'Integer':
      case 'Integer (Fixed)':
        return (
          <input
            type="number"
            step="1"
            value={value}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            className={baseClass}
            placeholder="Enter a whole number"
          />
        );
      case 'Double':
      case 'Non-Integer (Fixed)':
        return (
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            className={baseClass}
            placeholder="Enter a number"
          />
        );
      case 'Boolean':
        return (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={param.name}
                checked={value.toLowerCase() === 'true'}
                onChange={() => handleParamChange(param.name, 'true')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={param.name}
                checked={value.toLowerCase() === 'false'}
                onChange={() => handleParamChange(param.name, 'false')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
            </label>
          </div>
        );
      case 'DateTime (Fixed)':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            className={baseClass}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            className={baseClass}
            placeholder="Enter text"
          />
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <Modal
        isOpen={showParamModal}
        onClose={() => {}}
        title="Enter Parameters"
        hideCloseButton
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Please provide values for the following parameters:
          </p>
          {requiredParameters.map((param) => (
            <div key={param.name}>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                {param.prompt}
                <span className="ml-2 text-xs font-normal text-slate-500 dark:text-gray-500">({fixedValueMap[param.dataType] ? `Fixed: ${fixedValueMap[param.dataType].name}` : param.dataType})</span>
              </label>
              {renderParamInput(param)}
            </div>
          ))}
          {parameterHistory.length > 0 && (
            <div className="border-t border-slate-200 dark:border-gray-700 pt-3">
              <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Recent</p>
              <div className="space-y-1.5">
                {parameterHistory.map((entry, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPendingGlobalParamValues(entry)}
                    className="w-full text-left px-3 py-2 rounded-md border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-gray-700 dark:hover:border-blue-500 transition-colors text-sm text-slate-700 dark:text-gray-300 truncate"
                  >
                    {requiredParameters.map(p => entry[p.name] || '').filter(Boolean).join(' | ')}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowParamModal(false);
                setRequiredParameters([]);
                setPendingGlobalParamValues({});
                initialParamsSetRef.current = null;
                if (activeDashboardId) {
                  closeDashboard(activeDashboardId);
                }
              }}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleParamSubmit}
              disabled={!allParamsValid}
              className="h-9 px-4 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg bg-blue-600 text-white border border-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Continue
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!editingCellId}
        onClose={() => setEditingCellId(null)}
        title={`Parameters - ${editingCell?.title || 'Cell'}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Update parameter values for this cell:
          </p>
          {editingCellParams.map((param) => (
            <div key={param.name}>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                {param.prompt}
                <span className="ml-2 text-xs font-normal text-slate-500 dark:text-gray-500">({fixedValueMap[param.dataType] ? `Fixed: ${fixedValueMap[param.dataType].name}` : param.dataType})</span>
              </label>
              {renderCellParamInput(param)}
            </div>
          ))}
          <div className="flex items-center justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => setEditingCellId(null)}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCellParamSubmit}
              disabled={!editingCellAllParamsValid}
              className="h-9 px-4 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg bg-blue-600 text-white border border-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Apply
            </button>
          </div>
        </div>
      </Modal>

      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {openDashboards.length > 1 && (
          <div className="flex items-center gap-1 px-4 pt-2 overflow-x-auto">
            {openDashboards.map(({ dashboard }) => (
              <button
                key={dashboard.id}
                onClick={() => setActiveDashboard(dashboard.id)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 text-sm rounded-t-lg transition-colors
                  ${dashboard.id === activeDashboardId
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
              >
                <span className="truncate max-w-[150px]">{dashboard.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDashboard(dashboard.id);
                  }}
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
        )}

        <div className="h-16 px-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {activeDashboard.dashboard.name}
          </h1>
          <div className="flex items-center gap-2 flex-nowrap">
            {templates.length > 0 && (
              <>
                <CustomDropdown
                  value={selectedTemplateId || ''}
                  onChange={handleTemplateChange}
                  options={[
                    { value: '', label: 'No Template' },
                    ...templates.map(t => ({
                      value: t.id,
                      label: `${t.name}${t.is_default ? ' (Default)' : ''}`
                    }))
                  ]}
                  placeholder="Select template..."
                  size="sm"
                  autoWidth
                  dropdownMinWidth={160}
                />
                {(isAdmin || hasPermission('save_templates')) && selectedTemplateId && (
                  <>
                    {!selectedTemplate?.is_default && (
                      <button
                        onClick={async () => {
                          if (selectedTemplateId) await setDefaultTemplate(selectedTemplateId);
                        }}
                        className="p-1.5 text-gray-500 hover:text-yellow-500 dark:text-gray-400 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                        title="Set as default template"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteTemplate(true)}
                      className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete selected template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </>
            )}
            {cells.length > 0 && hasPermission('save_templates') && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasColumnChanges}
                  title="Save current template"
                >
                  <Save className="w-4 h-4" />
                  Save
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSaveAsModal(true)}
                  title="Save as new template"
                >
                  Save As
                </Button>
              </>
            )}
            {requiredParameters.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleEditAllParameters}
                title="Edit all parameters"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Parameters
              </Button>
            )}
            {isAdmin && activeDashboardId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAccessModal(true)}
                title="Manage dashboard access"
              >
                <Shield className="w-4 h-4" />
              </Button>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap px-1">
              {lastRefreshTime
                ? `Last: ${lastRefreshTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Last: --:--'}
            </span>
            <CustomDropdown
              value={String(autoRefreshMinutes)}
              onChange={handleAutoRefreshChange}
              options={[
                { value: '0', label: 'Auto: Off' },
                { value: '1', label: 'Auto: 1 min' },
                { value: '2', label: 'Auto: 2 min' },
                { value: '5', label: 'Auto: 5 min' },
                { value: '10', label: 'Auto: 10 min' },
                { value: '15', label: 'Auto: 15 min' },
                { value: '30', label: 'Auto: 30 min' },
              ]}
              size="sm"
              autoWidth
              dropdownMinWidth={130}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              loading={refreshing}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            {!activeDashboard.viewOnly && (
              <Button variant="secondary" size="sm" onClick={handleEdit}>
                <Settings className="w-4 h-4" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden">
        {cells.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400">No cells configured</p>
              <Button className="mt-4" onClick={handleEdit}>
                Configure Dashboard
              </Button>
            </div>
          </div>
        ) : fullscreenCellId ? (
          (() => {
            const cell = cells.find(c => c.id === fullscreenCellId);
            if (!cell) return null;
            return (
              <div className="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                {cell.title && (
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 min-w-0">
                      <span className="truncate">{cell.title}</span>
                      {cellRecordCounts[cell.id] !== undefined && (
                        <span className="text-gray-500 dark:text-gray-400 font-normal flex-shrink-0">
                          - {cellRecordCounts[cell.id]} records
                        </span>
                      )}
                      {cell.show_parameters_in_header && getCellParamSummary(cell.id) && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-normal bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded flex-shrink-0">
                          {getCellParamSummary(cell.id)}
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-1">
                      {buttonActions[cell.id]?.map(action => (
                        <button
                          key={action.id}
                          onClick={() => action.action_type === 'popup'
                            ? handlePopupButtonAction(cell.id, action)
                            : action.action_type === 'link'
                              ? handleLinkButtonAction(cell.id, action)
                              : handleExecuteButtonAction(cell.id, action)
                          }
                          disabled={action.action_type === 'execute' && executingAction === action.id}
                          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 ${
                            action.action_type === 'popup'
                              ? 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900/50'
                              : action.action_type === 'link'
                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                                : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                          }`}
                          title={action.display_name}
                        >
                          {action.action_type === 'popup' ? <FileText className="w-3 h-3" /> : action.action_type === 'link' ? <ExternalLink className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                          {action.display_name}
                        </button>
                      ))}
                      {hasPermission('edit_grid_layout') && (
                        <button
                          onClick={() => handleOpenFormatting(cell.id, cellColumns[cell.id] || [])}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Grid formatting"
                        >
                          <Palette className="w-4 h-4" />
                        </button>
                      )}
                      {cellHasParameters(cell.id) && (
                        <button
                          onClick={() => openCellParamModal(cell.id)}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Edit parameters"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </button>
                      )}
                      <div className="relative" data-export-dropdown>
                        <button
                          onClick={() => setExportDropdownCellId(exportDropdownCellId === cell.id ? null : cell.id)}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Export options"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {exportDropdownCellId === cell.id && (() => {
                          const selectedCount = cellRefs.current[cell.id]?.getSelectedRowCount() || 0;
                          return (
                            <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
                              {selectedCount > 0 && (
                                <div className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border-b border-gray-100 dark:border-gray-700">
                                  {selectedCount} row{selectedCount !== 1 ? 's' : ''} selected
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  const cellRef = cellRefs.current[cell.id];
                                  if (cellRef) {
                                    const name = cell.title || 'export';
                                    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                                    cellRef.downloadCsv(`${name}_${timestamp}.csv`);
                                    if (activeCompany) {
                                      logActivity('csv_export', activeCompany.id, cell.title || 'export', activeDashboardId || undefined);
                                    }
                                  }
                                  setExportDropdownCellId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                              >
                                <Download className="w-3.5 h-3.5" />
                                {selectedCount > 0 ? `Download ${selectedCount} rows` : 'Download CSV'}
                              </button>
                              <button
                                onClick={() => {
                                  const cellRef = cellRefs.current[cell.id];
                                  if (cellRef) {
                                    const name = cell.title || 'export';
                                    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                                    const fname = `${name}_${timestamp}.csv`;
                                    setEmailCsvContent(cellRef.getCsvString());
                                    setEmailFilename(fname);
                                    setEmailCellTitle(cell.title || 'Report');
                                    setEmailModalOpen(true);
                                  }
                                  setExportDropdownCellId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                {selectedCount > 0 ? `Email ${selectedCount} rows` : 'Email CSV'}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                      <button
                        onClick={() => setFullscreenCellId(null)}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Exit fullscreen"
                      >
                        <Minimize2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex-1 overflow-hidden min-h-0">
                  {parametersReady && (
                    <DashboardCell
                      ref={(ref) => { cellRefs.current[cell.id] = ref; }}
                      cell={cell}
                      onRecordCount={(count) => handleRecordCount(cell.id, count)}
                      parameterValues={getEffectiveParamsForCell(cell.id)}
                      activeTemplate={getActiveTemplateForCell(cell.id)}
                      templateId={selectedTemplateId}
                      onColumnChange={handleColumnChange}
                      onColumnsDetected={(columns) => handleColumnsDetected(cell.id, columns)}
                      onDrilldownColumnsDetected={(drilldownId, columns) => handleDrilldownColumnsDetected(cell.id, drilldownId, columns)}
                      formattingRules={getFormattingRulesForCell(cell.id)}
                      onGroupByChange={(groupBy) => handleGroupByChange(cell.id, groupBy)}
                      onActionComplete={handleActionComplete}
                      onPopupAction={handlePopupAction}
                    />
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="h-full flex flex-col gap-4">
            {rowIndices.map((rowIndex) => {
              const cellsInRow = getCellsInRow(rowIndex);
              const rowHeight = cellsInRow[0]?.height_percent ?? 100;

              return (
                <div
                  key={rowIndex}
                  className="flex gap-4 min-h-0"
                  style={{ height: `${rowHeight}%` }}
                >
                  {cellsInRow.map((cell) => (
                    <div
                      key={cell.id}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col min-h-0"
                      style={{ width: `${cell.width_percent}%` }}
                    >
                      {cell.title && (
                        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 min-w-0">
                            <span className="truncate">{cell.title}</span>
                            {cellRecordCounts[cell.id] !== undefined && (
                              <span className="text-gray-500 dark:text-gray-400 font-normal flex-shrink-0">
                                - {cellRecordCounts[cell.id]} records
                              </span>
                            )}
                            {cell.show_parameters_in_header && getCellParamSummary(cell.id) && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-normal bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded flex-shrink-0">
                                {getCellParamSummary(cell.id)}
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-1">
                            {buttonActions[cell.id]?.map(action => (
                              <button
                                key={action.id}
                                onClick={() => action.action_type === 'popup'
                                  ? handlePopupButtonAction(cell.id, action)
                                  : action.action_type === 'link'
                                    ? handleLinkButtonAction(cell.id, action)
                                    : handleExecuteButtonAction(cell.id, action)
                                }
                                disabled={action.action_type === 'execute' && executingAction === action.id}
                                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 ${
                                  action.action_type === 'popup'
                                    ? 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900/50'
                                    : action.action_type === 'link'
                                      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                                      : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                                }`}
                                title={action.display_name}
                              >
                                {action.action_type === 'popup' ? <FileText className="w-3 h-3" /> : action.action_type === 'link' ? <ExternalLink className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                                {action.display_name}
                              </button>
                            ))}
                            {hasPermission('edit_grid_layout') && (
                              <button
                                onClick={() => handleOpenFormatting(cell.id, cellColumns[cell.id] || [])}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                title="Grid formatting"
                              >
                                <Palette className="w-4 h-4" />
                              </button>
                            )}
                            {cellHasParameters(cell.id) && (
                              <button
                                onClick={() => openCellParamModal(cell.id)}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                title="Edit parameters"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                            )}
                            <div className="relative" data-export-dropdown>
                              <button
                                onClick={() => setExportDropdownCellId(exportDropdownCellId === cell.id ? null : cell.id)}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                title="Export options"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {exportDropdownCellId === cell.id && (() => {
                                const selectedCount = cellRefs.current[cell.id]?.getSelectedRowCount() || 0;
                                return (
                                  <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
                                    {selectedCount > 0 && (
                                      <div className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border-b border-gray-100 dark:border-gray-700">
                                        {selectedCount} row{selectedCount !== 1 ? 's' : ''} selected
                                      </div>
                                    )}
                                    <button
                                      onClick={() => {
                                        const cellRef = cellRefs.current[cell.id];
                                        if (cellRef) {
                                          const name = cell.title || 'export';
                                          const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                                          cellRef.downloadCsv(`${name}_${timestamp}.csv`);
                                          if (activeCompany) {
                                            logActivity('csv_export', activeCompany.id, cell.title || 'export', activeDashboardId || undefined);
                                          }
                                        }
                                        setExportDropdownCellId(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      {selectedCount > 0 ? `Download ${selectedCount} rows` : 'Download CSV'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        const cellRef = cellRefs.current[cell.id];
                                        if (cellRef) {
                                          const name = cell.title || 'export';
                                          const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                                          const fname = `${name}_${timestamp}.csv`;
                                          setEmailCsvContent(cellRef.getCsvString());
                                          setEmailFilename(fname);
                                          setEmailCellTitle(cell.title || 'Report');
                                          setEmailModalOpen(true);
                                        }
                                        setExportDropdownCellId(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                    >
                                      <Mail className="w-3.5 h-3.5" />
                                      {selectedCount > 0 ? `Email ${selectedCount} rows` : 'Email CSV'}
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                            {cells.length > 1 && (
                              <button
                                onClick={() => setFullscreenCellId(cell.id)}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                title="Fullscreen"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      <div
                        className="flex-1 overflow-hidden min-h-0"
                        onClick={() => setActiveCellId(cell.id)}
                      >
                        {parametersReady && (
                          <DashboardCell
                            ref={(ref) => { cellRefs.current[cell.id] = ref; }}
                            cell={cell}
                            onRecordCount={(count) => handleRecordCount(cell.id, count)}
                            parameterValues={getEffectiveParamsForCell(cell.id)}
                            activeTemplate={getActiveTemplateForCell(cell.id)}
                            templateId={selectedTemplateId}
                            onColumnChange={handleColumnChange}
                            onColumnsDetected={(columns) => handleColumnsDetected(cell.id, columns)}
                            onDrilldownColumnsDetected={(drilldownId, columns) => handleDrilldownColumnsDetected(cell.id, drilldownId, columns)}
                            formattingRules={getFormattingRulesForCell(cell.id)}
                            onGroupByChange={(groupBy) => handleGroupByChange(cell.id, groupBy)}
                            onActionComplete={handleActionComplete}
                            onPopupAction={handlePopupAction}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <GridFormattingModal
        isOpen={showFormattingModal}
        onClose={() => {
          setShowFormattingModal(false);
          setFormattingCellId(null);
        }}
        onSave={handleSaveFormatting}
        columns={formattingCellId ? (cellColumns[formattingCellId] || []) : []}
        initialRules={getActiveFormattingRules()}
        drilldowns={formattingCellId ? getDrilldownDefinitions(formattingCellId) : []}
      />

      <SaveTemplateModal
        isOpen={showSaveAsModal}
        onClose={() => {
          setShowSaveAsModal(false);
          setSaveAsTargetCellId(null);
        }}
        onSave={handleSaveAs}
        existingNames={templates.map(t => t.name)}
      />

      {actionProgress && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl px-8 py-6 w-80 flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Processing Action
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {actionProgress.name}
              </p>
            </div>
            <div className="w-full">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${actionProgress.total > 0 ? (actionProgress.current / actionProgress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                {actionProgress.current} of {actionProgress.total} row{actionProgress.total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      <ActionToast toasts={actionToasts} onDismiss={dismissToast} />

      <EmailCsvModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        csvContent={emailCsvContent}
        filename={emailFilename}
        cellTitle={emailCellTitle}
      />

      <Modal
        isOpen={confirmDeleteTemplate}
        onClose={() => setConfirmDeleteTemplate(false)}
        title="Delete Template"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">"{selectedTemplate?.name}"</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDeleteTemplate(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await deleteTemplate(selectedTemplateId);
                setSelectedTemplateId(null);
                setConfirmDeleteTemplate(false);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <PopupActionModal
        isOpen={!!popupModal}
        onClose={() => setPopupModal(null)}
        title={popupModal?.title || ''}
        template={popupModal?.template || ''}
        rowData={popupModal?.rowData || {}}
      />

      {activeDashboardId && activeCompany && (
        <DashboardAccessModal
          isOpen={showAccessModal}
          onClose={() => setShowAccessModal(false)}
          dashboardId={activeDashboardId}
          dashboardName={activeDashboard?.dashboard.name || 'Dashboard'}
          companyId={activeCompany.id}
        />
      )}
    </div>
  );
}
