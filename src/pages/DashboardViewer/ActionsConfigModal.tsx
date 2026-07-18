import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, GripVertical, Braces, Search, X, Info, Zap, Eye, ArrowUpDown } from 'lucide-react';
import { useCellActions } from '../../hooks/useCellActions';
import { useFixedValues } from '../../hooks/useFixedValues';
import { usePulses } from '../../hooks/usePulses';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type { QueryWithRelations, UserParameter, ActionParameterMapping, ActionMappingValueType, ActionType, PulseVariableMapping, ActionVisibilityCondition, ActionVisibilityOperator } from '../../types/database';

interface ActionConfig {
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
}

interface ActionsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  cellId: string | undefined;
  queries: QueryWithRelations[];
  availableColumns: string[];
}

export default function ActionsConfigModal({
  isOpen,
  onClose,
  cellId,
  queries,
  availableColumns,
}: ActionsConfigModalProps) {
  const { fetchActionsForCell, saveActions, loading: saving } = useCellActions();
  const { fixedValues } = useFixedValues();
  const { pulses } = usePulses();
  const [actions, setActions] = useState<ActionConfig[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [fieldPickerSearch, setFieldPickerSearch] = useState('');
  const [activeActionIndex, setActiveActionIndex] = useState<number | null>(null);
  const [activeParamName, setActiveParamName] = useState<string | null>(null);
  const templateTextareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const [reorderMode, setReorderMode] = useState(false);
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const actionQueries = queries.filter(q => q.purpose_type === 'action');
  const lookupQueries = queries.filter(q => q.purpose_type === 'lookup');

  useEffect(() => {
    if (!isOpen || !cellId) return;
    setReorderMode(false);

    const load = async () => {
      setLoadingActions(true);
      const data = await fetchActionsForCell(cellId);
      setActions(data.map(a => {
        let template = '';
        const raw = a.popup_template;
        if (typeof raw === 'string') {
          template = raw;
        } else if (Array.isArray(raw)) {
          template = (raw as Array<{ type: string; value: string }>)
            .map(seg => seg.type === 'field' ? `{${seg.value}}` : seg.value)
            .join('');
        }
        return {
          id: a.id,
          action_type: (a.action_type as ActionType) || 'execute',
          query_id: a.query_id || '',
          display_name: a.display_name,
          display_mode: a.display_mode,
          parameter_mappings: (a.parameter_mappings as ActionParameterMapping[]) || [],
          popup_template: template,
          link_url_template: a.link_url_template || '',
          sort_order: a.sort_order,
          refresh_after_execute: a.refresh_after_execute,
          post_action_pulse_id: a.post_action_pulse_id || null,
          pulse_variable_mappings: (a.pulse_variable_mappings as PulseVariableMapping[]) || [],
          visibility_condition: (a.visibility_condition as ActionVisibilityCondition) || null,
          prompt_title: a.prompt_title || '',
          prompt_description: a.prompt_description || '',
        };
      }));
      setLoadingActions(false);
    };

    load();
  }, [isOpen, cellId, fetchActionsForCell]);

  const handleAddAction = () => {
    setActions(prev => {
      const newActions = [
        ...prev,
        {
          action_type: 'execute' as const,
          query_id: '',
          display_name: '',
          display_mode: 'context_menu' as const,
          parameter_mappings: [],
          popup_template: '',
          link_url_template: '',
          sort_order: prev.length,
          refresh_after_execute: true,
          post_action_pulse_id: null,
          pulse_variable_mappings: [],
          visibility_condition: null,
        }
      ];
      setSelectedIndex(newActions.length - 1);
      return newActions;
    });
  };

  const handleRemoveAction = (index: number) => {
    setActions(prev => prev.filter((_, i) => i !== index).map((a, i) => ({ ...a, sort_order: i })));
    setSelectedIndex(prev => {
      if (prev >= actions.length - 1) return Math.max(0, actions.length - 2);
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const handleUpdateAction = (index: number, updates: Partial<ActionConfig>) => {
    setActions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const detectPathVariables = (path: string): string[] => {
    const regex = /\{([^}]+)\}/g;
    const vars: string[] = [];
    let match;
    while ((match = regex.exec(path)) !== null) {
      vars.push(match[1]);
    }
    return vars;
  };

  const handleQueryChange = (index: number, queryId: string) => {
    const query = queries.find(q => q.id === queryId);
    const userParams = (query?.user_parameters as UserParameter[]) || [];
    const mappings: ActionParameterMapping[] = userParams.map(p => {
      if (p.dataType === 'Lookup (Fixed)' && p.fixedValueId) {
        return {
          parameterName: p.name,
          target: 'lookup' as const,
          columnName: '',
          hardcodeValue: '',
          valueType: 'text' as const,
          promptText: p.prompt || p.name,
          fixedValueId: p.fixedValueId,
        };
      }
      return {
        parameterName: p.name,
        target: 'column' as const,
        columnName: '',
        hardcodeValue: '',
        valueType: 'text' as const,
      };
    });

    // Detect path variables from api_sub_path and add as mappable parameters
    const pathVars = detectPathVariables(query?.api_sub_path || '');
    const pathVarMappings: ActionParameterMapping[] = pathVars
      .filter(v => !userParams.some(p => p.name.replace(/^@/, '') === v && p.target === 'path'))
      .map(v => ({
        parameterName: `{${v}}`,
        target: 'column' as const,
        columnName: '',
        hardcodeValue: '',
        valueType: 'text' as const,
        isPathVariable: true,
      }));

    handleUpdateAction(index, {
      query_id: queryId,
      display_name: query?.name || '',
      parameter_mappings: [...mappings, ...pathVarMappings],
    });
  };

  const ensureMapping = (mappings: ActionParameterMapping[], paramName: string): ActionParameterMapping[] => {
    if (mappings.some(m => m.parameterName === paramName)) return mappings;
    return [...mappings, { parameterName: paramName, target: 'column', columnName: '', hardcodeValue: '', valueType: 'text' }];
  };

  const handleMappingChange = (actionIndex: number, paramName: string, columnName: string) => {
    const action = actions[actionIndex];
    const updated = ensureMapping(action.parameter_mappings, paramName).map(m =>
      m.parameterName === paramName ? { ...m, columnName } : m
    );
    handleUpdateAction(actionIndex, { parameter_mappings: updated });
  };

  const handleMappingTargetChange = (actionIndex: number, paramName: string, target: 'column' | 'hardcode' | 'prompt' | 'lookup' | 'fixed_value') => {
    const action = actions[actionIndex];
    const updated = ensureMapping(action.parameter_mappings, paramName).map(m =>
      m.parameterName === paramName ? {
        ...m,
        target,
        columnName: target === 'column' ? m.columnName : '',
        hardcodeValue: target === 'hardcode' ? (m.hardcodeValue || '') : '',
        valueType: target !== 'column' ? (m.valueType || 'text') : m.valueType,
        lookupQueryId: target === 'lookup' ? (m.lookupQueryId || '') : undefined,
        fixedValueId: (target === 'lookup' || target === 'fixed_value') ? (m.fixedValueId || '') : undefined,
        promptText: (target === 'prompt' || target === 'lookup' || target === 'fixed_value') ? (m.promptText || '') : undefined,
      } : m
    );
    handleUpdateAction(actionIndex, { parameter_mappings: updated });
  };

  const handleMappingLookupQueryChange = (actionIndex: number, paramName: string, lookupQueryId: string) => {
    const action = actions[actionIndex];
    const updated = ensureMapping(action.parameter_mappings, paramName).map(m =>
      m.parameterName === paramName ? { ...m, lookupQueryId, fixedValueId: undefined } : m
    );
    handleUpdateAction(actionIndex, { parameter_mappings: updated });
  };

  const handleMappingHardcodeChange = (actionIndex: number, paramName: string, hardcodeValue: string) => {
    const action = actions[actionIndex];
    const updated = ensureMapping(action.parameter_mappings, paramName).map(m =>
      m.parameterName === paramName ? { ...m, hardcodeValue } : m
    );
    handleUpdateAction(actionIndex, { parameter_mappings: updated });
  };

  const handleMappingValueTypeChange = (actionIndex: number, paramName: string, valueType: ActionMappingValueType) => {
    const action = actions[actionIndex];
    const updated = ensureMapping(action.parameter_mappings, paramName).map(m =>
      m.parameterName === paramName ? { ...m, valueType } : m
    );
    handleUpdateAction(actionIndex, { parameter_mappings: updated });
  };

  const handleMappingPromptTextChange = (actionIndex: number, paramName: string, promptText: string) => {
    const action = actions[actionIndex];
    const updated = ensureMapping(action.parameter_mappings, paramName).map(m =>
      m.parameterName === paramName ? { ...m, promptText } : m
    );
    handleUpdateAction(actionIndex, { parameter_mappings: updated });
  };

  const handleMappingFixedValueIdChange = (actionIndex: number, paramName: string, fixedValueId: string) => {
    const action = actions[actionIndex];
    const updated = ensureMapping(action.parameter_mappings, paramName).map(m =>
      m.parameterName === paramName ? { ...m, fixedValueId } : m
    );
    handleUpdateAction(actionIndex, { parameter_mappings: updated });
  };

  const openFieldPicker = (actionIndex: number, paramName: string) => {
    setActiveActionIndex(actionIndex);
    setActiveParamName(paramName);
    setFieldPickerSearch('');
    setShowFieldPicker(true);
  };

  const handleFieldSelect = (field: string) => {
    if (activeActionIndex !== null && activeParamName !== null) {
      if (activeParamName.startsWith('__pulse_var_idx__')) {
        const varIndex = parseInt(activeParamName.replace('__pulse_var_idx__', ''), 10);
        const action = actions[activeActionIndex];
        const updated = (action.pulse_variable_mappings || []).map((m, i) =>
          i === varIndex ? { ...m, sourceValue: field } : m
        );
        handleUpdateAction(activeActionIndex, { pulse_variable_mappings: updated });
      } else if (activeParamName.startsWith('__pulse_var__')) {
        const varName = activeParamName.replace('__pulse_var__', '');
        const action = actions[activeActionIndex];
        const updated = (action.pulse_variable_mappings || []).map(m =>
          m.variableName === varName ? { ...m, sourceValue: field } : m
        );
        const hasVar = updated.some(m => m.variableName === varName);
        if (!hasVar) {
          updated.push({ variableName: varName, source: 'column', sourceValue: field });
        }
        handleUpdateAction(activeActionIndex, { pulse_variable_mappings: updated });
      } else {
        handleMappingChange(activeActionIndex, activeParamName, field);
      }
    }
    setShowFieldPicker(false);
    setActiveActionIndex(null);
    setActiveParamName(null);
  };

  const extractLinkParams = (url: string): string[] => {
    const matches = url.match(/@\w+/g);
    if (!matches) return [];
    return [...new Set(matches)];
  };

  const handleLinkUrlChange = (index: number, url: string) => {
    const params = extractLinkParams(url);
    const action = actions[index];
    const existingMappings = action.parameter_mappings;

    const newMappings: ActionParameterMapping[] = params.map(paramName => {
      const existing = existingMappings.find(m => m.parameterName === paramName);
      if (existing) return existing;
      return {
        parameterName: paramName,
        target: 'column',
        columnName: '',
        hardcodeValue: '',
        valueType: 'text',
      };
    });

    handleUpdateAction(index, { link_url_template: url, parameter_mappings: newMappings });
  };

  const handleSave = async () => {
    if (!cellId) return;

    const validActions = actions.filter(a =>
      a.action_type === 'popup'
        ? a.display_name && a.popup_template.trim().length > 0
        : a.action_type === 'link'
          ? a.display_name && a.link_url_template.trim().length > 0
          : a.query_id
    );
    const { error } = await saveActions(cellId, validActions);
    if (!error) {
      onClose();
    }
  };

  const filteredFields = availableColumns.filter(field => {
    if (!fieldPickerSearch.trim()) return true;
    return field.toLowerCase().includes(fieldPickerSearch.toLowerCase());
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cell Actions" size="xl">
      <div className="space-y-3">
        {!cellId && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Save the dashboard first to configure actions on this cell.
            </p>
          </div>
        )}

        {actionQueries.length === 0 && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              No action-type queries found. Create a query with type "Action" in the Query Manager first.
            </p>
          </div>
        )}

        {loadingActions ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" style={{ height: '60vh' }}>
            {/* Sidebar - Action List */}
            <div className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col">
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleAddAction}
                  disabled={!cellId}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Action
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {actions.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6 px-3">
                    No actions yet
                  </p>
                ) : reorderMode ? (
                  <div className="p-2 space-y-1">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 px-1 mb-2">
                      Drag to reorder
                    </p>
                    {actions.map((action, index) => (
                      <div
                        key={action.id || index}
                        draggable
                        onDragStart={() => { dragItemRef.current = index; }}
                        onDragEnter={() => { dragOverItemRef.current = index; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={() => {
                          if (dragItemRef.current === null || dragOverItemRef.current === null) return;
                          const reordered = [...actions];
                          const [removed] = reordered.splice(dragItemRef.current, 1);
                          reordered.splice(dragOverItemRef.current, 0, removed);
                          setActions(reordered.map((a, i) => ({ ...a, sort_order: i })));
                          dragItemRef.current = null;
                          dragOverItemRef.current = null;
                        }}
                        className="flex items-center gap-2 px-2 py-2 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 cursor-grab active:cursor-grabbing hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className={`text-[10px] font-medium px-1 py-0.5 rounded shrink-0 ${
                          action.action_type === 'popup'
                            ? 'text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30'
                            : action.action_type === 'link'
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30'
                              : 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30'
                        }`}>
                          {action.action_type === 'popup' ? 'Pop' : action.action_type === 'link' ? 'Lnk' : 'Exe'}
                        </span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                          {action.display_name || '(unnamed)'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 space-y-0.5">
                    {actions.map((action, index) => (
                      <button
                        key={action.id || index}
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-colors ${
                          selectedIndex === index
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent'
                        }`}
                      >
                        <span className={`text-[10px] font-medium px-1 py-0.5 rounded shrink-0 ${
                          action.action_type === 'popup'
                            ? 'text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30'
                            : action.action_type === 'link'
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30'
                              : 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30'
                        }`}>
                          {action.action_type === 'popup' ? 'Pop' : action.action_type === 'link' ? 'Lnk' : 'Exe'}
                        </span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                          {action.display_name || '(unnamed)'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar footer controls */}
              <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-1">
                {actions.length > 1 && (
                  <button
                    onClick={() => setReorderMode(!reorderMode)}
                    disabled={!cellId}
                    className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                      reorderMode
                        ? 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    {reorderMode ? 'Done' : 'Order'}
                  </button>
                )}
              </div>
            </div>

            {/* Detail Panel */}
            <div className="flex-1 overflow-y-auto p-4">
              {actions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No actions configured. Click "Add Action" to enable right-click or button triggers on this cell.
                  </p>
                </div>
              ) : reorderMode ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ArrowUpDown className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Drag actions in the sidebar to reorder. Click "Done" when finished.
                  </p>
                </div>
              ) : (() => {
                const index = selectedIndex;
                const action = actions[index];
                if (!action) return (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Select an action from the sidebar</p>
                  </div>
                );

                const selectedActionQuery = queries.find(q => q.id === action.query_id);
                const userParams = (selectedActionQuery?.user_parameters as UserParameter[]) || [];

                return (
                  <div className="space-y-4">
                    {/* Header with delete */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          action.action_type === 'popup'
                            ? 'text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30'
                            : action.action_type === 'link'
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30'
                              : 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30'
                        }`}>
                          {action.action_type === 'popup' ? 'Popup' : action.action_type === 'link' ? 'Link' : 'Execute'}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {action.display_name || `Action ${index + 1}`}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveAction(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete action"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Action Type
                          </label>
                          <CustomDropdown
                            value={action.action_type}
                            onChange={(val) => handleUpdateAction(index, {
                              action_type: val as ActionType,
                              query_id: (val === 'popup' || val === 'link') ? '' : action.query_id,
                              popup_template: val === 'popup' ? action.popup_template : '',
                              link_url_template: val === 'link' ? action.link_url_template : '',
                              parameter_mappings: val === 'link' ? extractLinkParams(action.link_url_template).map(p => ({ parameterName: p, target: 'column' as const, columnName: '', hardcodeValue: '', valueType: 'text' as const })) : (val === 'popup' ? [] : action.parameter_mappings),
                            })}
                            options={[
                              { value: 'execute', label: 'Execute (API Call)' },
                              { value: 'popup', label: 'Popup (Display Info)' },
                              { value: 'link', label: 'Link (Open URL)' },
                            ]}
                            size="sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Display Mode
                          </label>
                          <CustomDropdown
                            value={action.display_mode}
                            onChange={(val) => handleUpdateAction(index, { display_mode: val as 'context_menu' | 'button' | 'both' })}
                            options={[
                              { value: 'context_menu', label: 'Context Menu (Right-Click)' },
                              { value: 'button', label: 'Header Button' },
                              { value: 'both', label: 'Both (Menu + Button)' },
                            ]}
                            size="sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={action.display_name}
                          onChange={(e) => handleUpdateAction(index, { display_name: e.target.value })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          placeholder={action.action_type === 'popup' ? 'e.g., View Details' : 'e.g., Approve Record'}
                        />
                      </div>

                      {action.action_type === 'execute' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Action Query
                            </label>
                            <CustomDropdown
                              value={action.query_id}
                              onChange={(val) => handleQueryChange(index, val)}
                              options={actionQueries.map(q => ({ value: q.id, label: q.name }))}
                              placeholder="Select an action query"
                              size="sm"
                            />
                          </div>

                          <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={action.refresh_after_execute}
                                onChange={(e) => handleUpdateAction(index, { refresh_after_execute: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400">Refresh after run</span>
                            </label>
                          </div>

                          {/* Post-Action Pulse */}
                          <div className="pt-2 border-t border-indigo-200 dark:border-indigo-800">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                              <Zap className="w-3.5 h-3.5 text-indigo-500" />
                              Post-Action Pulse
                              <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              Trigger a Pulse after this action succeeds. The Pulse can send emails, call APIs, or run conditions using values from this action.
                            </p>
                            <CustomDropdown
                              value={action.post_action_pulse_id || ''}
                              onChange={(val) => {
                                handleUpdateAction(index, {
                                  post_action_pulse_id: val || null,
                                  pulse_variable_mappings: val ? (action.pulse_variable_mappings || []) : [],
                                });
                              }}
                              options={[
                                { value: '', label: '-- No Pulse --' },
                                ...pulses
                                  .filter(p => p.trigger_type === 'action')
                                  .map(p => ({ value: p.id, label: p.name })),
                              ]}
                              placeholder="Select a pulse to trigger..."
                              size="sm"
                            />

                            {action.post_action_pulse_id && (() => {
                              const mappings = action.pulse_variable_mappings || [];

                              const handleAddPulseVariable = () => {
                                const updated: PulseVariableMapping[] = [
                                  ...mappings,
                                  { variableName: '', source: 'column', sourceValue: '' },
                                ];
                                handleUpdateAction(index, { pulse_variable_mappings: updated });
                              };

                              const handleRemovePulseVariable = (varIndex: number) => {
                                const updated = mappings.filter((_, i) => i !== varIndex);
                                handleUpdateAction(index, { pulse_variable_mappings: updated });
                              };

                              const handlePulseVarNameChange = (varIndex: number, name: string) => {
                                const updated = mappings.map((m, i) =>
                                  i === varIndex ? { ...m, variableName: name.replace(/\s/g, '_').toUpperCase() } : m
                                );
                                handleUpdateAction(index, { pulse_variable_mappings: updated });
                              };

                              const handlePulseVarSourceChange = (varIndex: number, source: string) => {
                                const updated = mappings.map((m, i) =>
                                  i === varIndex ? { ...m, source: source as 'column' | 'hardcode' | 'prompt' | 'current_user', sourceValue: source === 'current_user' ? 'full_name' : '' } : m
                                );
                                handleUpdateAction(index, { pulse_variable_mappings: updated });
                              };

                              const handlePulseVarValueChange = (varIndex: number, sourceValue: string) => {
                                const updated = mappings.map((m, i) =>
                                  i === varIndex ? { ...m, sourceValue } : m
                                );
                                handleUpdateAction(index, { pulse_variable_mappings: updated });
                              };

                              return (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                      Variable Mappings
                                    </label>
                                    <button
                                      type="button"
                                      onClick={handleAddPulseVariable}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Add Variable
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Define variables to pass to the Pulse. Use "Detect Variables" in the Pulse Builder to import these.
                                  </p>
                                  {mappings.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic py-2">
                                      No variables mapped. Click "Add Variable" to pass data to the Pulse.
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {mappings.map((mapping, varIndex) => (
                                        <div key={varIndex} className="flex items-center gap-1.5">
                                          <input
                                            type="text"
                                            value={mapping.variableName}
                                            onChange={(e) => handlePulseVarNameChange(varIndex, e.target.value)}
                                            className="w-28 shrink-0 px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            placeholder="VAR_NAME"
                                          />
                                          <span className="text-xs text-gray-400 shrink-0">&rarr;</span>
                                          <div className="w-24 shrink-0">
                                            <CustomDropdown
                                              value={mapping.source}
                                              onChange={(val) => handlePulseVarSourceChange(varIndex, val)}
                                              options={[
                                                { value: 'column', label: 'Column' },
                                                { value: 'hardcode', label: 'Hardcode' },
                                                { value: 'prompt', label: 'Prompt' },
                                                { value: 'current_user', label: 'Current User' },
                                              ]}
                                              size="sm"
                                            />
                                          </div>
                                          {mapping.source === 'column' && (
                                            <>
                                              <div className="flex-1">
                                                <CustomDropdown
                                                  value={mapping.sourceValue}
                                                  onChange={(val) => handlePulseVarValueChange(varIndex, val)}
                                                  options={availableColumns.map(col => ({ value: col, label: col }))}
                                                  placeholder="Select column"
                                                  size="sm"
                                                />
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveActionIndex(index);
                                                  setActiveParamName(`__pulse_var_idx__${varIndex}`);
                                                  setFieldPickerSearch('');
                                                  setShowFieldPicker(true);
                                                }}
                                                disabled={availableColumns.length === 0}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                                title="Pick column"
                                              >
                                                <Braces className="w-3.5 h-3.5" />
                                              </button>
                                            </>
                                          )}
                                          {mapping.source === 'hardcode' && (
                                            <div className="flex-1">
                                              <input
                                                type="text"
                                                value={mapping.sourceValue}
                                                onChange={(e) => handlePulseVarValueChange(varIndex, e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                placeholder="Enter value"
                                              />
                                            </div>
                                          )}
                                          {mapping.source === 'prompt' && (
                                            <div className="flex-1">
                                              <CustomDropdown
                                                value={mapping.sourceValue}
                                                onChange={(val) => handlePulseVarValueChange(varIndex, val)}
                                                options={action.parameter_mappings
                                                  .filter(m => m.target === 'prompt' || m.target === 'lookup')
                                                  .map(m => ({ value: m.parameterName, label: m.parameterName }))}
                                                placeholder="Select prompt parameter"
                                                size="sm"
                                              />
                                            </div>
                                          )}
                                          {mapping.source === 'current_user' && (
                                            <div className="flex-1">
                                              <CustomDropdown
                                                value={mapping.sourceValue || 'full_name'}
                                                onChange={(val) => handlePulseVarValueChange(varIndex, val)}
                                                options={[
                                                  { value: 'full_name', label: 'Full Name' },
                                                  { value: 'email', label: 'Email' },
                                                  { value: 'username', label: 'Username' },
                                                ]}
                                                size="sm"
                                              />
                                            </div>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleRemovePulseVariable(varIndex)}
                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors shrink-0"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Prompt Dialog Customization */}
                          {(action.action_type === 'execute') && (
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                Prompt Dialog <span className="font-normal text-gray-400">(optional)</span>
                              </label>
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={action.prompt_title || ''}
                                  onChange={(e) => handleUpdateAction(index, { prompt_title: e.target.value })}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                  placeholder="Enter Parameter Values"
                                />
                                <input
                                  type="text"
                                  value={action.prompt_description || ''}
                                  onChange={(e) => handleUpdateAction(index, { prompt_description: e.target.value })}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                  placeholder="Provide values for the following parameters before executing."
                                />
                              </div>
                            </div>
                          )}

                          {userParams.length > 0 && (
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                Parameter Mappings
                              </label>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Map each parameter to a column, hardcoded value, user prompt, or lookup dropdown.
                              </p>
                              <div className="space-y-2">
                                {userParams.map(param => {
                                  const mapping = action.parameter_mappings.find(m => m.parameterName === param.name);
                                  const currentTarget = mapping?.target || 'column';
                                  const currentColumn = mapping?.columnName || '';
                                  const currentHardcode = mapping?.hardcodeValue || '';
                                  const currentValueType = mapping?.valueType || 'text';
                                  const isLookup = currentTarget === 'lookup';
                                  const lookupQuery = isLookup && mapping?.lookupQueryId
                                    ? queries.find(q => q.id === mapping.lookupQueryId)
                                    : null;

                                  return (
                                    <div key={param.name} className="space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-gray-600 dark:text-gray-400 w-28 truncate shrink-0" title={param.name}>
                                          {param.name}
                                        </span>
                                        <span className="text-xs text-gray-400 shrink-0">&rarr;</span>
                                        <div className="w-32 shrink-0">
                                          <CustomDropdown
                                            value={currentTarget}
                                            onChange={(val) => handleMappingTargetChange(index, param.name, val as 'column' | 'hardcode' | 'prompt' | 'lookup' | 'fixed_value')}
                                            options={[
                                              { value: 'column', label: 'Column' },
                                              { value: 'hardcode', label: 'Hardcode' },
                                              { value: 'prompt', label: 'Prompt' },
                                              { value: 'lookup', label: 'Lookup' },
                                              { value: 'fixed_value', label: 'Fixed Value' },
                                            ]}
                                            size="sm"
                                          />
                                        </div>
                                        {isLookup ? (
                                          <div className="flex-1 flex items-center gap-2">
                                            <div className="flex-1">
                                              <CustomDropdown
                                                value={mapping?.lookupQueryId || ''}
                                                onChange={(val) => handleMappingLookupQueryChange(index, param.name, val)}
                                                options={lookupQueries.map(q => ({ value: q.id, label: q.name }))}
                                                placeholder="Select lookup query..."
                                                size="sm"
                                              />
                                            </div>
                                            {lookupQuery && (
                                              <span className="text-xs text-purple-600 dark:text-purple-400 italic shrink-0">Dropdown at runtime</span>
                                            )}
                                          </div>
                                        ) : (
                                          <>
                                            {currentTarget === 'column' && (
                                              <>
                                                <div className="flex-1">
                                                  <CustomDropdown
                                                    value={currentColumn}
                                                    onChange={(val) => handleMappingChange(index, param.name, val)}
                                                    options={availableColumns.map(col => ({ value: col, label: col }))}
                                                    placeholder="Select column"
                                                    size="sm"
                                                  />
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => openFieldPicker(index, param.name)}
                                                  disabled={availableColumns.length === 0}
                                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                                  title="Pick column"
                                                >
                                                  <Braces className="w-4 h-4" />
                                                </button>
                                              </>
                                            )}
                                            {currentTarget === 'hardcode' && (
                                              <>
                                                <div className="flex-1">
                                                  <input
                                                    type="text"
                                                    value={currentHardcode}
                                                    onChange={(e) => handleMappingHardcodeChange(index, param.name, e.target.value)}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                    placeholder="Enter value"
                                                  />
                                                </div>
                                                <div className="w-28 shrink-0">
                                                  <CustomDropdown
                                                    value={currentValueType}
                                                    onChange={(val) => handleMappingValueTypeChange(index, param.name, val as ActionMappingValueType)}
                                                    options={[
                                                      { value: 'text', label: 'Text' },
                                                      { value: 'date', label: 'Date' },
                                                      { value: 'integer', label: 'Integer' },
                                                      { value: 'double', label: 'Double' },
                                                      { value: 'boolean', label: 'Boolean' },
                                                    ]}
                                                    size="sm"
                                                  />
                                                </div>
                                              </>
                                            )}
                                            {currentTarget === 'prompt' && (
                                              <>
                                                <div className="flex-1">
                                                  <input
                                                    type="text"
                                                    value={mapping?.promptText || ''}
                                                    onChange={(e) => handleMappingPromptTextChange(index, param.name, e.target.value)}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                    placeholder="Prompt text shown to user"
                                                  />
                                                </div>
                                                <div className="w-28 shrink-0">
                                                  <CustomDropdown
                                                    value={currentValueType}
                                                    onChange={(val) => handleMappingValueTypeChange(index, param.name, val as ActionMappingValueType)}
                                                    options={[
                                                      { value: 'text', label: 'Text' },
                                                      { value: 'date', label: 'Date' },
                                                      { value: 'integer', label: 'Integer' },
                                                      { value: 'double', label: 'Double' },
                                                      { value: 'boolean', label: 'Boolean' },
                                                    ]}
                                                    size="sm"
                                                  />
                                                </div>
                                              </>
                                            )}
                                            {currentTarget === 'fixed_value' && (
                                              <div className="flex-1">
                                                <CustomDropdown
                                                  value={mapping?.fixedValueId || ''}
                                                  onChange={(val) => handleMappingFixedValueIdChange(index, param.name, val)}
                                                  options={fixedValues.map(fv => ({ value: fv.id, label: `# ${fv.name}` }))}
                                                  placeholder="Select fixed value..."
                                                  size="sm"
                                                  searchable
                                                />
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                      {(isLookup || (currentTarget === 'fixed_value' && mapping?.fixedValueId && (() => { const fv = fixedValues.find(f => f.id === mapping.fixedValueId); return fv?.is_list || fv?.value_type === 'lookup'; })())) && (
                                        <div className="ml-[calc(7rem+2.5rem)] mt-1">
                                          <input
                                            type="text"
                                            value={mapping?.promptText || ''}
                                            onChange={(e) => handleMappingPromptTextChange(index, param.name, e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            placeholder="Display label (e.g. Select Driver)"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Path Variable Mappings */}
                          {action.parameter_mappings.filter(m => m.isPathVariable).length > 0 && (
                            <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                              <label className="block text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
                                Path Variable Mappings
                              </label>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Map URL path variables to grid columns or values.
                              </p>
                              <div className="space-y-2">
                                {action.parameter_mappings.filter(m => m.isPathVariable).map(mapping => {
                                  const currentTarget = mapping.target || 'column';
                                  const currentColumn = mapping.columnName || '';
                                  const currentHardcode = mapping.hardcodeValue || '';

                                  return (
                                    <div key={mapping.parameterName} className="space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 text-xs font-mono w-28 shrink-0">
                                          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-700">
                                            {mapping.parameterName}
                                          </span>
                                        </span>
                                        <span className="text-xs text-gray-400 shrink-0">&rarr;</span>
                                        <div className="w-32 shrink-0">
                                          <CustomDropdown
                                            value={currentTarget}
                                            onChange={(val) => handleMappingTargetChange(index, mapping.parameterName, val as 'column' | 'hardcode' | 'prompt' | 'lookup' | 'fixed_value')}
                                            options={[
                                              { value: 'column', label: 'Column' },
                                              { value: 'hardcode', label: 'Hardcode' },
                                              { value: 'prompt', label: 'Prompt' },
                                              { value: 'lookup', label: 'Lookup' },
                                              { value: 'fixed_value', label: 'Fixed Value' },
                                            ]}
                                            size="sm"
                                          />
                                        </div>
                                        {currentTarget === 'lookup' && (
                                          <div className="flex-1">
                                            <CustomDropdown
                                              value={mapping.lookupQueryId || ''}
                                              onChange={(val) => handleMappingLookupQueryChange(index, mapping.parameterName, val)}
                                              options={lookupQueries.map(q => ({ value: q.id, label: q.name }))}
                                              placeholder="Select lookup query..."
                                              size="sm"
                                            />
                                          </div>
                                        )}
                                        {currentTarget === 'column' && (
                                          <>
                                            <div className="flex-1">
                                              <CustomDropdown
                                                value={currentColumn}
                                                onChange={(val) => handleMappingChange(index, mapping.parameterName, val)}
                                                options={availableColumns.map(col => ({ value: col, label: col }))}
                                                placeholder="Select column"
                                                size="sm"
                                              />
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => openFieldPicker(index, mapping.parameterName)}
                                              disabled={availableColumns.length === 0}
                                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                              title="Pick column"
                                            >
                                              <Braces className="w-4 h-4" />
                                            </button>
                                          </>
                                        )}
                                        {currentTarget === 'hardcode' && (
                                          <div className="flex-1">
                                            <input
                                              type="text"
                                              value={currentHardcode}
                                              onChange={(e) => handleMappingHardcodeChange(index, mapping.parameterName, e.target.value)}
                                              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                              placeholder="Enter value"
                                            />
                                          </div>
                                        )}
                                        {currentTarget === 'prompt' && (
                                          <div className="flex-1">
                                            <input
                                              type="text"
                                              value={mapping.promptText || ''}
                                              onChange={(e) => handleMappingPromptTextChange(index, mapping.parameterName, e.target.value)}
                                              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                              placeholder="Prompt text shown to user"
                                            />
                                          </div>
                                        )}
                                        {currentTarget === 'fixed_value' && (
                                          <div className="flex-1">
                                            <CustomDropdown
                                              value={mapping.fixedValueId || ''}
                                              onChange={(val) => handleMappingFixedValueIdChange(index, mapping.parameterName, val)}
                                              options={fixedValues.map(fv => ({ value: fv.id, label: `# ${fv.name}` }))}
                                              placeholder="Select fixed value..."
                                              size="sm"
                                              searchable
                                            />
                                          </div>
                                        )}
                                      </div>
                                      {(currentTarget === 'lookup' || (currentTarget === 'fixed_value' && mapping.fixedValueId && (() => { const fv = fixedValues.find(f => f.id === mapping.fixedValueId); return fv?.is_list || fv?.value_type === 'lookup'; })())) && (
                                        <div className="ml-[calc(7rem+2.5rem)] mt-1">
                                          <input
                                            type="text"
                                            value={mapping.promptText || ''}
                                            onChange={(e) => handleMappingPromptTextChange(index, mapping.parameterName, e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            placeholder="Display label (e.g. Select Driver)"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {action.action_type === 'popup' && (
                        <div className="pt-2 border-t border-sky-200 dark:border-sky-800">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Popup Template
                          </label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Write your message below. Use the "Insert Field" button to add column values. Fields appear as {'{FIELD_NAME}'} and get replaced with row data.
                          </p>
                          <textarea
                            ref={(el) => { templateTextareaRefs.current[index] = el; }}
                            value={action.popup_template}
                            onChange={(e) => handleUpdateAction(index, { popup_template: e.target.value })}
                            rows={6}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono resize-y"
                            placeholder={`Example:\n{DESTINATION} {CONTAINER}\nHI DRIVER GO HERE\n{DOCK_NUMBER} {CHASSIS_NUMBER}\nTHANKS DISPATCH`}
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Insert field:</span>
                            <CustomDropdown
                              value=""
                              onChange={(val) => {
                                const textarea = templateTextareaRefs.current[index];
                                const insertion = `{${val}}`;
                                if (textarea) {
                                  const start = textarea.selectionStart;
                                  const end = textarea.selectionEnd;
                                  const current = action.popup_template;
                                  const newTemplate = current.substring(0, start) + insertion + current.substring(end);
                                  handleUpdateAction(index, { popup_template: newTemplate });
                                  setTimeout(() => {
                                    textarea.focus();
                                    textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
                                  }, 0);
                                } else {
                                  handleUpdateAction(index, { popup_template: action.popup_template + insertion });
                                }
                              }}
                              options={availableColumns.map(col => ({ value: col, label: col }))}
                              placeholder="Select a field..."
                              size="sm"
                            />
                          </div>
                        </div>
                      )}

                      {action.action_type === 'link' && (
                        <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            URL Template
                          </label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Enter the URL with @Parameter placeholders. Each parameter will be populated from a grid column, filter, or user entry.
                          </p>
                          <input
                            type="text"
                            value={action.link_url_template}
                            onChange={(e) => handleLinkUrlChange(index, e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                            placeholder="https://example.com/view?id=@Record_ID&type=@Type"
                          />
                          {extractLinkParams(action.link_url_template).length > 0 && (
                            <div className="mt-3">
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                                Parameter Mappings
                              </label>
                              <div className="space-y-2">
                                {extractLinkParams(action.link_url_template).map(paramName => {
                                  const lMapping = action.parameter_mappings.find(m => m.parameterName === paramName);
                                  const lTarget = lMapping?.target || 'column';
                                  const lColumn = lMapping?.columnName || '';
                                  const lHardcode = lMapping?.hardcodeValue || '';

                                  return (
                                    <div key={paramName} className="space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 w-28 truncate shrink-0" title={paramName}>
                                          {paramName}
                                        </span>
                                        <span className="text-xs text-gray-400 shrink-0">&rarr;</span>
                                        <div className="w-32 shrink-0">
                                          <CustomDropdown
                                            value={lTarget}
                                            onChange={(val) => handleMappingTargetChange(index, paramName, val as 'column' | 'hardcode' | 'prompt' | 'lookup' | 'fixed_value')}
                                            options={[
                                              { value: 'column', label: 'Cell from Grid' },
                                              { value: 'hardcode', label: 'Hardcode' },
                                              { value: 'prompt', label: 'User Entry' },
                                              { value: 'lookup', label: 'Lookup' },
                                              { value: 'fixed_value', label: 'Fixed Value' },
                                            ]}
                                            size="sm"
                                          />
                                        </div>
                                        {lTarget === 'lookup' && (
                                          <div className="flex-1">
                                            <CustomDropdown
                                              value={lMapping?.lookupQueryId || ''}
                                              onChange={(val) => handleMappingLookupQueryChange(index, paramName, val)}
                                              options={lookupQueries.map(q => ({ value: q.id, label: q.name }))}
                                              placeholder="Select lookup query..."
                                              size="sm"
                                            />
                                          </div>
                                        )}
                                        {lTarget === 'column' && (
                                          <>
                                            <div className="flex-1">
                                              <CustomDropdown
                                                value={lColumn}
                                                onChange={(val) => handleMappingChange(index, paramName, val)}
                                                options={availableColumns.map(col => ({ value: col, label: col }))}
                                                placeholder="Select column"
                                                size="sm"
                                              />
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => openFieldPicker(index, paramName)}
                                              disabled={availableColumns.length === 0}
                                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                              title="Pick column"
                                            >
                                              <Braces className="w-4 h-4" />
                                            </button>
                                          </>
                                        )}
                                        {lTarget === 'hardcode' && (
                                          <div className="flex-1">
                                            <input
                                              type="text"
                                              value={lHardcode}
                                              onChange={(e) => handleMappingHardcodeChange(index, paramName, e.target.value)}
                                              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                              placeholder="Enter value"
                                            />
                                          </div>
                                        )}
                                        {lTarget === 'prompt' && (
                                          <div className="flex-1">
                                            <input
                                              type="text"
                                              value={lMapping?.promptText || ''}
                                              onChange={(e) => handleMappingPromptTextChange(index, paramName, e.target.value)}
                                              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                              placeholder="Prompt text shown to user"
                                            />
                                          </div>
                                        )}
                                        {lTarget === 'fixed_value' && (
                                          <div className="flex-1">
                                            <CustomDropdown
                                              value={lMapping?.fixedValueId || ''}
                                              onChange={(val) => handleMappingFixedValueIdChange(index, paramName, val)}
                                              options={fixedValues.map(fv => ({ value: fv.id, label: `# ${fv.name}` }))}
                                              placeholder="Select fixed value..."
                                              size="sm"
                                              searchable
                                            />
                                          </div>
                                        )}
                                      </div>
                                      {(lTarget === 'lookup' || (lTarget === 'fixed_value' && lMapping?.fixedValueId && (() => { const fv = fixedValues.find(f => f.id === lMapping.fixedValueId); return fv?.is_list || fv?.value_type === 'lookup'; })())) && (
                                        <div className="ml-[calc(7rem+2.5rem)] mt-1">
                                          <input
                                            type="text"
                                            value={lMapping?.promptText || ''}
                                            onChange={(e) => handleMappingPromptTextChange(index, paramName, e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            placeholder="Display label (e.g. Select Driver)"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Visibility Condition */}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                          Visibility Condition
                          <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!action.visibility_condition}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleUpdateAction(index, { visibility_condition: { field: '', operator: 'is_not_empty', value: '' } });
                                } else {
                                  handleUpdateAction(index, { visibility_condition: null });
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-400">Only show when condition is met</span>
                          </label>
                        </div>
                        {action.visibility_condition && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <CustomDropdown
                              value={action.visibility_condition.field}
                              onChange={(val) => handleUpdateAction(index, { visibility_condition: { ...action.visibility_condition!, field: val } })}
                              options={availableColumns.map(c => ({ value: c, label: c }))}
                              placeholder="Select column..."
                              size="sm"
                            />
                            <CustomDropdown
                              value={action.visibility_condition.operator}
                              onChange={(val) => handleUpdateAction(index, { visibility_condition: { ...action.visibility_condition!, operator: val as ActionVisibilityOperator } })}
                              options={[
                                { value: 'is_not_empty', label: 'Is not empty' },
                                { value: 'is_empty', label: 'Is empty' },
                                { value: 'equals', label: 'Equals' },
                                { value: 'not_equals', label: 'Does not equal' },
                                { value: 'contains', label: 'Contains' },
                                { value: 'greater_than', label: 'Greater than' },
                                { value: 'less_than', label: 'Less than' },
                              ]}
                              size="sm"
                            />
                            {!['is_not_empty', 'is_empty'].includes(action.visibility_condition.operator) && (
                              <input
                                type="text"
                                value={action.visibility_condition.value}
                                onChange={(e) => handleUpdateAction(index, { visibility_condition: { ...action.visibility_condition!, value: e.target.value } })}
                                className="flex-1 min-w-[100px] px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                placeholder="Value..."
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-2">
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!cellId}
          >
            Save Actions
          </Button>
        </div>
      </div>

      {showFieldPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Braces className="w-4 h-4" />
                Select Column
              </h4>
              <button
                onClick={() => {
                  setShowFieldPicker(false);
                  setActiveActionIndex(null);
                  setActiveParamName(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={fieldPickerSearch}
                  onChange={(e) => setFieldPickerSearch(e.target.value)}
                  placeholder="Search columns..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {filteredFields.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No matching columns found</p>
              ) : (
                filteredFields.map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => handleFieldSelect(field)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <span className="font-mono text-sm text-gray-900 dark:text-white">{field}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
