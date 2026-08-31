import { useMemo, useEffect, useState } from 'react';
import { FileText, Loader2, FunctionSquare, Braces } from 'lucide-react';
import { useQueries } from '../../../hooks/useQueries';
import { useFixedValues } from '../../../hooks/useFixedValues';
import { useLookupResolver } from '../../../hooks/useLookupResolver';
import { useDateFunctions } from '../../../hooks/useDateFunctions';
import { useTheme } from '../../../contexts/ThemeContext';
import { isDateFunctionRef, getDateFunctionId, makeDateFunctionRef, computeDateFunction } from '../../../lib/dateFunctions';
import CustomDropdown from '../../../components/ui/CustomDropdown';
import DatePicker from '../../../components/ui/DatePicker';
import type { PulseRunReportStepConfig, UserParameter, FixedValueListItem, PulseInputVariable } from '../../../types/database';

type MappingSource = 'query_column' | 'query_field' | 'hardcoded' | 'input_variable' | 'fixed_value' | 'date_function';

interface ParameterMapping {
  paramName: string;
  source: MappingSource;
  sourceValue: string;
  sourceNodeId?: string;
}

interface PathVariableMapping {
  variableName: string;
  source: MappingSource;
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

interface RunReportConfigPanelProps {
  config: PulseRunReportStepConfig | null;
  onChange: (config: PulseRunReportStepConfig) => void;
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
          className="flex-1 px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
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
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700 rounded-md">
              <Braces className="w-3 h-3 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span className="text-xs font-mono text-rose-800 dark:text-rose-300 truncate">{selectedLabel}</span>
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
              ? 'border-rose-400 dark:border-rose-600 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-600 dark:hover:text-rose-400'
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

export default function RunReportConfigPanel({ config, onChange, inputVariables, upstreamQueryNodes }: RunReportConfigPanelProps) {
  const { queries } = useQueries();
  const { fixedValues } = useFixedValues();
  const { resolveLookup, getLookupState } = useLookupResolver();
  const { dateFunctions } = useDateFunctions();
  const { isDark } = useTheme();

  const current: PulseRunReportStepConfig = config || {
    stepType: 'run_report',
    name: '',
    stepName: '',
    queryId: undefined,
    responseVariableName: '',
    attachmentFilename: '',
    parameterMappings: [],
    pathVariableMappings: [],
    queryParameterMappings: [],
    timeout: 60,
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

  const pathVariableNames = useMemo<string[]>(() => {
    const cfg = (selectedAction?.path_variable_config as Record<string, unknown> | null) || null;
    if (!cfg) return [];
    return Object.keys(cfg);
  }, [selectedAction]);

  const enabledQueryParamKeys = useMemo<string[]>(() => {
    const params = (selectedAction?.query_parameters as Array<{ key: string; enabled: boolean }> | null) || [];
    return params.filter(p => p && p.enabled && p.key).map(p => p.key);
  }, [selectedAction]);

  const parameterMappings = current.parameterMappings || [];
  const pathVariableMappings = current.pathVariableMappings || [];
  const queryParameterMappings = current.queryParameterMappings || [];

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

  useEffect(() => {
    if (pathVariableNames.length === 0) return;
    const existing = new Set(pathVariableMappings.map(m => m.variableName));
    let changed = false;
    const updated = [...pathVariableMappings];
    pathVariableNames.forEach(name => {
      if (!existing.has(name)) {
        changed = true;
        updated.push({ variableName: name, source: 'hardcoded', sourceValue: '' });
      }
    });
    if (changed) {
      emit({ pathVariableMappings: updated });
    }
  }, [pathVariableNames]);

  useEffect(() => {
    if (enabledQueryParamKeys.length === 0) return;
    const existing = new Set(queryParameterMappings.map(m => m.paramName));
    let changed = false;
    const updated = [...queryParameterMappings];
    enabledQueryParamKeys.forEach(name => {
      if (!existing.has(name)) {
        changed = true;
        updated.push({ paramName: name, source: 'hardcoded', sourceValue: '' });
      }
    });
    if (changed) {
      emit({ queryParameterMappings: updated });
    }
  }, [enabledQueryParamKeys]);

  useEffect(() => {
    const all = [...parameterMappings, ...pathVariableMappings, ...queryParameterMappings];
    all.forEach(m => {
      if (m.source === 'fixed_value' && m.sourceValue) {
        const fv = fixedValues.find(v => v.id === m.sourceValue);
        if (fv && fv.value_type === 'lookup') {
          resolveLookup(fv);
        }
      }
    });
  }, [parameterMappings, pathVariableMappings, queryParameterMappings, fixedValues, resolveLookup]);

  const emit = (updates: Partial<PulseRunReportStepConfig>) => {
    onChange({ ...current, ...updates });
  };

  const handleParamMappingChange = (paramName: string, updates: Partial<ParameterMapping>) => {
    const updated = parameterMappings.map(m =>
      m.paramName === paramName ? { ...m, ...updates } : m
    );
    emit({ parameterMappings: updated });
  };

  const handlePathVarMappingChange = (variableName: string, updates: Partial<PathVariableMapping>) => {
    const updated = pathVariableMappings.map(m =>
      m.variableName === variableName ? { ...m, ...updates } : m
    );
    emit({ pathVariableMappings: updated });
  };

  const handleQueryParamMappingChange = (paramName: string, updates: Partial<ParameterMapping>) => {
    const updated = queryParameterMappings.map(m =>
      m.paramName === paramName ? { ...m, ...updates } : m
    );
    emit({ queryParameterMappings: updated });
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

  const sourceOptionsForContext = SOURCE_OPTIONS.filter(opt => {
    if (opt.value === 'input_variable' && (!inputVariables || inputVariables.length === 0)) return false;
    if (opt.value === 'query_field' && (!upstreamQueryNodes || upstreamQueryNodes.length === 0)) return false;
    return true;
  });

  const renderSourceValueEditor = (
    source: MappingSource,
    sourceValue: string,
    onValueChange: (val: string) => void,
    placeholder: string,
  ) => {
    switch (source) {
      case 'query_field':
      case 'query_column':
        return (
          <QueryFieldPicker
            value={sourceValue || ''}
            onChange={onValueChange}
            upstreamColumnOptions={upstreamColumnOptions}
            isDark={isDark}
          />
        );

      case 'input_variable':
        return (
          <CustomDropdown
            value={sourceValue || ''}
            onChange={onValueChange}
            options={inputVarOptions}
            placeholder="Select variable..."
            dark={isDark}
          />
        );

      case 'fixed_value': {
        const selectedFv = fixedValues.find(fv => fv.id === sourceValue);
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
                value={sourceValue || ''}
                onChange={onValueChange}
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
            value={sourceValue || ''}
            onChange={onValueChange}
            options={[...fixedValueOptions, ...fixedValueListOptions]}
            placeholder="Select fixed value..."
            dark={isDark}
          />
        );
      }

      case 'date_function':
        return (
          <DateParamInput
            value={sourceValue || ''}
            onChange={onValueChange}
            dateFunctions={dateFunctions}
            placeholder={placeholder}
          />
        );

      case 'hardcoded':
      default:
        return (
          <input
            type="text"
            value={sourceValue || ''}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        );
    }
  };

  const renderMappingRow = (opts: {
    keyId: string;
    displayLabel: string;
    subLabel?: string;
    pillClasses: string;
    containerClasses: string;
    source: MappingSource;
    sourceValue: string;
    onSourceChange: (s: MappingSource) => void;
    onValueChange: (v: string) => void;
    placeholder: string;
  }) => (
    <div key={opts.keyId} className={`p-3 rounded-lg border ${opts.containerClasses}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded border ${opts.pillClasses}`}>
          {opts.displayLabel}
        </span>
        {opts.subLabel && (
          <span className="text-[9px] text-gray-400 dark:text-gray-500">{opts.subLabel}</span>
        )}
      </div>

      <div className="mb-2">
        <CustomDropdown
          value={opts.source}
          onChange={(val) => opts.onSourceChange(val as MappingSource)}
          options={sourceOptionsForContext}
          placeholder="Select source..."
          dark={isDark}
        />
      </div>

      {renderSourceValueEditor(opts.source, opts.sourceValue, opts.onValueChange, opts.placeholder)}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-7 h-7 rounded-md bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Run Report</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Fetch a PDF report to attach downstream</p>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Step Name
        </label>
        <input
          type="text"
          value={current.stepName}
          onChange={(e) => emit({ stepName: e.target.value, name: e.target.value })}
          placeholder="e.g. Monthly Report"
          className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Report
        </label>
        <CustomDropdown
          value={current.queryId || ''}
          onChange={(val) => {
            const q = queries.find(qq => qq.id === val);
            emit({
              queryId: val || undefined,
              actionName: q?.name || undefined,
              parameterMappings: [],
              pathVariableMappings: [],
              queryParameterMappings: [],
            });
          }}
          options={actionOptions}
          placeholder="Select a report action..."
          dark={isDark}
        />
        {selectedAction?.api_endpoints && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 truncate">
            {(selectedAction.api_endpoints as { base_url?: string })?.base_url || ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
            Output Variable Name
          </label>
          <input
            type="text"
            value={current.responseVariableName || ''}
            onChange={(e) => emit({ responseVariableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
            placeholder="e.g. monthlyReportPdf"
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
            Downstream email step will attach this PDF by variable name.
          </p>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
            Attachment Filename
          </label>
          <input
            type="text"
            value={current.attachmentFilename || ''}
            onChange={(e) => emit({ attachmentFilename: e.target.value })}
            placeholder="report_{date}.pdf"
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
            Optional. Defaults to the step name plus .pdf. Use {'{date}'} for today's date.
          </p>
        </div>
      </div>

      {pathVariableNames.length > 0 && (
        <div>
          <label className="block text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-2 uppercase tracking-wider">
            Path Variables
          </label>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
            Values below replace the URL path variables of the selected report at run time.
          </p>
          <div className="space-y-3">
            {pathVariableNames.map((name) => {
              const mapping = pathVariableMappings.find(m => m.variableName === name) || {
                variableName: name,
                source: 'hardcoded' as MappingSource,
                sourceValue: '',
              };
              return renderMappingRow({
                keyId: `pv-${name}`,
                displayLabel: `{${name}}`,
                pillClasses: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
                containerClasses: 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
                source: mapping.source,
                sourceValue: mapping.sourceValue,
                onSourceChange: (s) => handlePathVarMappingChange(name, { source: s, sourceValue: '', sourceNodeId: undefined }),
                onValueChange: (v) => handlePathVarMappingChange(name, { sourceValue: v }),
                placeholder: name,
              });
            })}
          </div>
        </div>
      )}

      {enabledQueryParamKeys.length > 0 && (
        <div>
          <label className="block text-[10px] font-semibold text-teal-700 dark:text-teal-400 mb-2 uppercase tracking-wider">
            Query Parameters
          </label>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
            Values below replace the URL query parameters of the selected report at run time.
          </p>
          <div className="space-y-3">
            {enabledQueryParamKeys.map((name) => {
              const mapping = queryParameterMappings.find(m => m.paramName === name) || {
                paramName: name,
                source: 'hardcoded' as MappingSource,
                sourceValue: '',
              };
              return renderMappingRow({
                keyId: `qp-${name}`,
                displayLabel: name,
                pillClasses: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700',
                containerClasses: 'bg-teal-50/60 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800',
                source: mapping.source,
                sourceValue: mapping.sourceValue,
                onSourceChange: (s) => handleQueryParamMappingChange(name, { source: s, sourceValue: '', sourceNodeId: undefined }),
                onValueChange: (v) => handleQueryParamMappingChange(name, { sourceValue: v }),
                placeholder: name,
              });
            })}
          </div>
        </div>
      )}

      {userParams.length > 0 && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            Parameter Mappings
          </label>
          <div className="space-y-3">
            {userParams.map((param) => {
              const mapping = parameterMappings.find(m => m.paramName === param.name) || {
                paramName: param.name,
                source: 'hardcoded' as MappingSource,
                sourceValue: '',
              };
              return renderMappingRow({
                keyId: `up-${param.name}`,
                displayLabel: param.prompt || param.name,
                subLabel: param.dataType,
                pillClasses: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600',
                containerClasses: 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600',
                source: mapping.source,
                sourceValue: mapping.sourceValue,
                onSourceChange: (s) => handleParamMappingChange(param.name, { source: s, sourceValue: '', sourceNodeId: undefined }),
                onValueChange: (v) => handleParamMappingChange(param.name, { sourceValue: v }),
                placeholder: param.prompt || param.name,
              });
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
            Timeout (s)
          </label>
          <input
            type="number"
            value={current.timeout ?? 60}
            onChange={(e) => emit({ timeout: parseInt(e.target.value) || 60 })}
            min={5}
            max={600}
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
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
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      <div className="p-3 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-lg">
        <p className="text-[10px] text-rose-700 dark:text-rose-300">
          The workflow will stop and the error will be recorded in Pulse Logs if this report fails to run.
        </p>
      </div>

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
