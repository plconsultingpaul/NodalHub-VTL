import { useMemo, useEffect, useState } from 'react';
import { Zap, Loader2, FunctionSquare, Braces } from 'lucide-react';
import { useQueries } from '../../../hooks/useQueries';
import { useFixedValues } from '../../../hooks/useFixedValues';
import { useLookupResolver } from '../../../hooks/useLookupResolver';
import { useDateFunctions } from '../../../hooks/useDateFunctions';
import { useTheme } from '../../../contexts/ThemeContext';
import { isDateFunctionRef, getDateFunctionId, makeDateFunctionRef, computeDateFunction } from '../../../lib/dateFunctions';
import CustomDropdown from '../../../components/ui/CustomDropdown';
import DatePicker from '../../../components/ui/DatePicker';
import type { PulseActionStepConfig, UserParameter, FixedValueListItem, PulseInputVariable, PulseQueryStepConfig } from '../../../types/database';

interface ParameterMapping {
  paramName: string;
  source: 'query_column' | 'query_field' | 'hardcoded' | 'input_variable' | 'fixed_value' | 'date_function';
  sourceValue: string;
  sourceNodeId?: string;
}

interface UpstreamQueryNode {
  id: string;
  label: string;
  queryId?: string;
  responseVariableName?: string;
  lastKnownColumns?: string[];
}

interface ActionConfigPanelProps {
  config: PulseActionStepConfig | null;
  onChange: (config: PulseActionStepConfig) => void;
  inputVariables?: PulseInputVariable[];
  upstreamQueryNodes?: UpstreamQueryNode[];
}

function DateParamInput({
  value,
  onChange,
  dateFunctions,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  dateFunctions: { id: string; name: string; base_date: string; string_format: string; adjust_years: number; adjust_months: number; adjust_days: number; description: string | null }[];
  placeholder: string;
}) {
  const isFnMode = isDateFunctionRef(value);
  const selectedFnId = isFnMode ? getDateFunctionId(value) : '';
  const selectedFn = dateFunctions.find(f => f.id === selectedFnId);

  const sampleValue = selectedFn
    ? computeDateFunction(selectedFn.base_date as Parameters<typeof computeDateFunction>[0], selectedFn.string_format, selectedFn.adjust_years, selectedFn.adjust_months, selectedFn.adjust_days)
    : '';

  const toggleMode = () => {
    if (isFnMode) {
      onChange('');
    } else if (dateFunctions.length > 0) {
      onChange(makeDateFunctionRef(dateFunctions[0].id));
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleMode}
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
            isFnMode
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}
        >
          <FunctionSquare className="w-2.5 h-2.5" />
          fn
        </button>
      </div>
      {isFnMode ? (
        <div className="space-y-1">
          <CustomDropdown
            value={selectedFnId}
            onChange={(v) => onChange(makeDateFunctionRef(v))}
            options={dateFunctions.map(f => ({ value: f.id, label: f.name }))}
            placeholder="Select function..."
          />
          {sampleValue && (
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">{sampleValue}</p>
          )}
        </div>
      ) : (
        <DatePicker value={value} onChange={onChange} placeholder={placeholder} />
      )}
    </div>
  );
}

const SOURCE_OPTIONS = [
  { value: 'hardcoded', label: 'Hardcoded Value' },
  { value: 'query_field', label: 'Query Field' },
  { value: 'input_variable', label: 'Input Variable' },
  { value: 'fixed_value', label: 'Fixed Value' },
  { value: 'date_function', label: 'Date Function' },
];

function QueryFieldPicker({
  value,
  onChange,
  upstreamColumnOptions,
  isDark,
}: {
  value: string;
  onChange: (v: string) => void;
  upstreamColumnOptions: { value: string; label: string }[];
  isDark: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedLabel = upstreamColumnOptions.find(o => o.value === value)?.label;

  if (upstreamColumnOptions.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. variableName::columnName"
          className="flex-1 px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="button"
          disabled
          className="flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed"
          title="Test the upstream query in Query Manager to load available fields"
        >
          <Braces className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          {selectedLabel ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md">
              <Braces className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-xs font-mono text-amber-800 dark:text-amber-300 truncate">{selectedLabel}</span>
            </div>
          ) : (
            <div className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-xs text-gray-400 dark:text-gray-500">
              No field selected
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className={`flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${
            showPicker
              ? 'border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:border-amber-300 dark:hover:border-amber-700 hover:text-amber-600 dark:hover:text-amber-400'
          }`}
          title="Pick a field from upstream query"
        >
          <Braces className="w-3.5 h-3.5" />
        </button>
      </div>
      {showPicker && (
        <CustomDropdown
          value={value}
          onChange={(val) => {
            onChange(val);
            setShowPicker(false);
          }}
          options={upstreamColumnOptions}
          placeholder="Select a field..."
          dark={isDark}
        />
      )}
    </div>
  );
}

export default function ActionConfigPanel({ config, onChange, inputVariables, upstreamQueryNodes }: ActionConfigPanelProps) {
  const { queries } = useQueries();
  const { fixedValues } = useFixedValues();
  const { resolveLookup, getLookupState } = useLookupResolver();
  const { dateFunctions } = useDateFunctions();
  const { isDark } = useTheme();

  const current: PulseActionStepConfig = config || {
    stepType: 'action',
    name: '',
    stepName: '',
    queryId: undefined,
    parameterMappings: [],
    onError: 'stop',
    timeout: 30,
    retryCount: 0,
  };

  const selectedAction = useMemo(() => {
    if (!current.queryId) return null;
    return queries.find((q) => q.id === current.queryId) || null;
  }, [current.queryId, queries]);

  const userParams = useMemo<UserParameter[]>(() => {
    if (!selectedAction?.user_parameters) return [];
    return (selectedAction.user_parameters as UserParameter[]) || [];
  }, [selectedAction]);

  const parameterMappings = current.parameterMappings || [];

  useEffect(() => {
    if (userParams.length === 0) return;
    const existing = new Set(parameterMappings.map(m => m.paramName));
    let changed = false;
    const updated = [...parameterMappings];
    userParams.forEach(p => {
      if (!existing.has(p.name)) {
        changed = true;
        updated.push({ paramName: p.name, source: 'hardcoded', sourceValue: '' });
      }
    });
    if (changed) {
      emit({ parameterMappings: updated });
    }
  }, [userParams]);

  // Resolve lookups for fixed values
  useEffect(() => {
    parameterMappings.forEach(m => {
      if (m.source === 'fixed_value' && m.sourceValue) {
        const fv = fixedValues.find(v => v.id === m.sourceValue);
        if (fv && fv.value_type === 'lookup') {
          resolveLookup(fv);
        }
      }
    });
  }, [parameterMappings, fixedValues, resolveLookup]);

  const emit = (updates: Partial<PulseActionStepConfig>) => {
    onChange({ ...current, ...updates });
  };

  const handleMappingChange = (paramName: string, updates: Partial<ParameterMapping>) => {
    const updated = parameterMappings.map(m =>
      m.paramName === paramName ? { ...m, ...updates } : m
    );
    emit({ parameterMappings: updated });
  };

  const actionOptions = queries
    .filter(q => q.purpose_type === 'action' && (q.app_target === 'pulse' || q.app_target === 'both'))
    .map(q => ({ value: q.id, label: q.name }));

  const upstreamColumnOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    (upstreamQueryNodes || []).forEach(node => {
      const queryRecord = queries.find(q => q.id === node.queryId);
      const raw = (queryRecord?.last_known_columns as unknown[]) || node.lastKnownColumns || [];
      const columns: string[] = raw
        .map((c: unknown) => {
          if (typeof c === 'string') {
            if (c.startsWith('[') || c.startsWith('{') || c.startsWith('"')) return null;
            return c;
          }
          if (c && typeof c === 'object' && 'name' in c) return (c as { name: string }).name;
          return null;
        })
        .filter((c): c is string => !!c);
      if (columns.length > 0) {
        const varName = node.responseVariableName || node.id;
        columns.forEach(col => {
          options.push({
            value: `${varName}::${col}`,
            label: `${node.label} > ${col}`,
          });
        });
      }
    });
    return options;
  }, [upstreamQueryNodes, queries]);

  const inputVarOptions = useMemo(() => {
    return (inputVariables || []).map(v => ({
      value: v.name,
      label: `{{${v.name}}} (${v.dataType})`,
    }));
  }, [inputVariables]);

  const fixedValueOptions = useMemo(() => {
    return fixedValues
      .filter(fv => !fv.is_list && fv.value_type !== 'lookup')
      .map(fv => ({ value: fv.id, label: fv.name }));
  }, [fixedValues]);

  const fixedValueListOptions = useMemo(() => {
    return fixedValues
      .filter(fv => fv.is_list)
      .map(fv => ({ value: fv.id, label: fv.name }));
  }, [fixedValues]);

  const renderParameterMappingValue = (mapping: ParameterMapping, param: UserParameter) => {
    switch (mapping.source) {
      case 'query_field':
        return (
          <QueryFieldPicker
            value={mapping.sourceValue || ''}
            onChange={(val) => handleMappingChange(mapping.paramName, { sourceValue: val })}
            upstreamColumnOptions={upstreamColumnOptions}
            isDark={isDark}
          />
        );

      case 'query_column':
        return (
          <QueryFieldPicker
            value={mapping.sourceValue || ''}
            onChange={(val) => handleMappingChange(mapping.paramName, { sourceValue: val })}
            upstreamColumnOptions={upstreamColumnOptions}
            isDark={isDark}
          />
        );

      case 'input_variable':
        return (
          <CustomDropdown
            value={mapping.sourceValue || ''}
            onChange={(val) => handleMappingChange(mapping.paramName, { sourceValue: val })}
            options={inputVarOptions}
            placeholder="Select variable..."
            dark={isDark}
          />
        );

      case 'fixed_value': {
        const selectedFv = fixedValues.find(fv => fv.id === mapping.sourceValue);
        if (selectedFv?.value_type === 'lookup') {
          const lookupState = getLookupState(selectedFv.id);
          if (lookupState.loading) {
            return (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading...
              </div>
            );
          }
        }
        if (selectedFv?.is_list) {
          const listItems = (selectedFv.list_values as FixedValueListItem[]) || [];
          return (
            <div className="space-y-1.5">
              <CustomDropdown
                value={mapping.sourceValue || ''}
                onChange={(val) => handleMappingChange(mapping.paramName, { sourceValue: val })}
                options={fixedValueListOptions}
                placeholder="Select fixed value list..."
                dark={isDark}
              />
              {selectedFv && listItems.length > 0 && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {listItems.length} item{listItems.length !== 1 ? 's' : ''} available at runtime
                </p>
              )}
            </div>
          );
        }
        return (
          <CustomDropdown
            value={mapping.sourceValue || ''}
            onChange={(val) => handleMappingChange(mapping.paramName, { sourceValue: val })}
            options={[...fixedValueOptions, ...fixedValueListOptions]}
            placeholder="Select fixed value..."
            dark={isDark}
          />
        );
      }

      case 'date_function':
        return (
          <DateParamInput
            value={mapping.sourceValue || ''}
            onChange={(val) => handleMappingChange(mapping.paramName, { sourceValue: val })}
            dateFunctions={dateFunctions}
            placeholder={param.prompt || param.name}
          />
        );

      case 'hardcoded':
      default:
        return (
          <input
            type="text"
            value={mapping.sourceValue || ''}
            onChange={(e) => handleMappingChange(mapping.paramName, { sourceValue: e.target.value })}
            placeholder={param.prompt || param.name}
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Action</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Post-Query Action Configuration</p>
        </div>
      </div>

      {/* Step Name */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Step Name
        </label>
        <input
          type="text"
          value={current.stepName}
          onChange={(e) => emit({ stepName: e.target.value, name: e.target.value })}
          placeholder="e.g. Update Record"
          className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Action Selection */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Action
        </label>
        <CustomDropdown
          value={current.queryId || ''}
          onChange={(val) => {
            const q = queries.find(qq => qq.id === val);
            emit({ queryId: val || undefined, actionName: q?.name || undefined, parameterMappings: [] });
          }}
          options={actionOptions}
          placeholder="Select an action..."
          dark={isDark}
        />
        {selectedAction?.api_endpoints && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 truncate">
            {(selectedAction.api_endpoints as { base_url?: string })?.base_url || ''}
          </p>
        )}
      </div>

      {/* Parameter Mappings */}
      {userParams.length > 0 && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            Parameter Mappings
          </label>
          <div className="space-y-3">
            {userParams.map((param) => {
              const mapping = parameterMappings.find(m => m.paramName === param.name) || {
                paramName: param.name,
                source: 'hardcoded' as const,
                sourceValue: '',
              };

              return (
                <div key={param.name} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {param.prompt || param.name}
                    {param.dataType && (
                      <span className="ml-1.5 text-[9px] font-normal text-gray-400 dark:text-gray-500">
                        ({param.dataType})
                      </span>
                    )}
                  </label>

                  {/* Source selector */}
                  <div className="mb-2">
                    <CustomDropdown
                      value={mapping.source}
                      onChange={(val) => handleMappingChange(mapping.paramName, {
                        source: val as ParameterMapping['source'],
                        sourceValue: '',
                        sourceNodeId: undefined,
                      })}
                      options={SOURCE_OPTIONS.filter(opt => {
                        if (opt.value === 'input_variable' && (!inputVariables || inputVariables.length === 0)) return false;
                        if (opt.value === 'query_field' && (!upstreamQueryNodes || upstreamQueryNodes.length === 0)) return false;
                        return true;
                      })}
                      placeholder="Select source..."
                      dark={isDark}
                    />
                  </div>

                  {/* Value input based on source */}
                  {renderParameterMappingValue(mapping, param)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Handling */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          On Error
        </label>
        <CustomDropdown
          value={current.onError || 'stop'}
          onChange={(val) => emit({ onError: val as 'stop' | 'continue' })}
          options={[
            { value: 'stop', label: 'Stop workflow' },
            { value: 'continue', label: 'Continue to next step' },
          ]}
          dark={isDark}
        />
      </div>

      {/* Timeout & Retry */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
            Timeout (s)
          </label>
          <input
            type="number"
            value={current.timeout ?? 30}
            onChange={(e) => emit({ timeout: parseInt(e.target.value) || 30 })}
            min={5}
            max={300}
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
            Retries
          </label>
          <input
            type="number"
            value={current.retryCount ?? 0}
            onChange={(e) => emit({ retryCount: parseInt(e.target.value) || 0 })}
            min={0}
            max={5}
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Input Variables Reference */}
      {inputVariables && inputVariables.length > 0 && (
        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
            Available Input Variables
          </p>
          <div className="flex flex-wrap gap-1.5">
            {inputVariables.map((v) => (
              <span
                key={v.name}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-mono cursor-default"
                title={`${v.label || v.name} (${v.dataType})`}
              >
                {`{{${v.name}}}`}
                <span className="text-indigo-400 dark:text-indigo-500 text-[9px] font-sans">{v.dataType}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
