import { useMemo, useEffect } from 'react';
import { Database, Loader2, FunctionSquare } from 'lucide-react';
import { useQueries } from '../../../hooks/useQueries';
import { useFixedValues } from '../../../hooks/useFixedValues';
import { useLookupResolver } from '../../../hooks/useLookupResolver';
import { useDateFunctions } from '../../../hooks/useDateFunctions';
import { useTheme } from '../../../contexts/ThemeContext';
import { isDateFunctionRef, getDateFunctionId, makeDateFunctionRef, computeDateFunction } from '../../../lib/dateFunctions';
import CustomDropdown from '../../../components/ui/CustomDropdown';
import DatePicker from '../../../components/ui/DatePicker';
import type { PulseQueryStepConfig, UserParameter, FixedValueListItem, PulseInputVariable } from '../../../types/database';

interface ApiEndpointConfigPanelProps {
  config: PulseQueryStepConfig | null;
  onChange: (config: PulseQueryStepConfig) => void;
  inputVariables?: PulseInputVariable[];
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
          {isFnMode ? 'fn' : 'fn'}
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

export default function ApiEndpointConfigPanel({ config, onChange, inputVariables }: ApiEndpointConfigPanelProps) {
  const { queries } = useQueries();
  const { fixedValues, getResolvedValue } = useFixedValues();
  const { resolveLookup, getLookupState } = useLookupResolver();
  const { dateFunctions } = useDateFunctions();
  const { isDark } = useTheme();

  const current: PulseQueryStepConfig = config || {
    stepType: 'query',
    name: '',
    stepName: '',
    queryId: undefined,
    parameterValues: {},
  };

  const selectedQuery = useMemo(() => {
    if (!current.queryId) return null;
    return queries.find((q) => q.id === current.queryId) || null;
  }, [current.queryId, queries]);

  const userParams = useMemo<UserParameter[]>(() => {
    if (!selectedQuery?.user_parameters) return [];
    return (selectedQuery.user_parameters as UserParameter[]) || [];
  }, [selectedQuery]);

  const paramValues = current.parameterValues || {};

  useEffect(() => {
    if (userParams.length === 0) return;
    const updated: Record<string, string> = { ...paramValues };
    let changed = false;
    userParams.forEach(p => {
      if (!(p.name in updated)) {
        changed = true;
        if (p.fixedValueId) {
          const fv = fixedValues.find(v => v.id === p.fixedValueId);
          updated[p.name] = fv ? getResolvedValue(fv) : '';
        } else {
          updated[p.name] = '';
        }
      }
    });
    if (changed) {
      emit({ parameterValues: updated });
    }
  }, [userParams, fixedValues]);

  useEffect(() => {
    userParams.forEach(p => {
      if (p.fixedValueId) {
        const fv = fixedValues.find(v => v.id === p.fixedValueId);
        if (fv && fv.value_type === 'lookup') {
          resolveLookup(fv);
        }
      }
    });
  }, [userParams, fixedValues, resolveLookup]);

  const emit = (updates: Partial<PulseQueryStepConfig>) => {
    onChange({ ...current, ...updates });
  };

  const handleParamChange = (name: string, value: string) => {
    emit({ parameterValues: { ...paramValues, [name]: value } });
  };

  const queryOptions = queries.filter(q => q.app_target === 'pulse' || q.app_target === 'both').map(q => ({
    value: q.id,
    label: q.name,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
          <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Query</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Query Configuration</p>
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
          placeholder="e.g. Fetch Orders"
          className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Query Selection */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Query
        </label>
        <CustomDropdown
          value={current.queryId || ''}
          onChange={(val) => {
            const q = queries.find(qq => qq.id === val);
            emit({ queryId: val || undefined, queryName: q?.name || undefined, parameterValues: {} });
          }}
          options={queryOptions}
          placeholder="Select a query..."
          dark={isDark}
        />
        {selectedQuery?.api_endpoints && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 truncate">
            {selectedQuery.api_endpoints.base_url}
          </p>
        )}
      </div>

      {/* Parameters */}
      {userParams.length > 0 && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            Parameters
          </label>
          <div className="space-y-2.5">
            {userParams.map((param) => {
              const linkedFixedValue = param.fixedValueId
                ? fixedValues.find(fv => fv.id === param.fixedValueId)
                : null;

              if (linkedFixedValue?.value_type === 'lookup') {
                const lookupState = getLookupState(linkedFixedValue.id);
                return (
                  <div key={param.name}>
                    <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                      {param.prompt || param.name}
                    </label>
                    {lookupState.loading ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading...
                      </div>
                    ) : lookupState.error ? (
                      <p className="text-[10px] text-red-500">{lookupState.error}</p>
                    ) : (
                      <CustomDropdown
                        value={paramValues[param.name] || ''}
                        onChange={(val) => handleParamChange(param.name, val)}
                        options={lookupState.options}
                        placeholder={`Select...`}
                        dark={isDark}
                      />
                    )}
                  </div>
                );
              }

              const isListType = linkedFixedValue?.is_list;
              const listItems = isListType
                ? ((linkedFixedValue?.list_values as FixedValueListItem[]) || [])
                : [];

              return (
                <div key={param.name}>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                    {param.prompt || param.name}
                  </label>
                  {isListType && listItems.length > 0 ? (
                    <CustomDropdown
                      value={paramValues[param.name] || ''}
                      onChange={(val) => handleParamChange(param.name, val)}
                      options={listItems.map((item) => ({
                        value: item.value,
                        label: item.description || item.value,
                      }))}
                      placeholder={`Select...`}
                      dark={isDark}
                    />
                  ) : (param.dataType === 'Date' || param.dataType === 'Date (Fixed)') ? (
                    <DateParamInput
                      value={paramValues[param.name] || ''}
                      onChange={(v) => handleParamChange(param.name, v)}
                      dateFunctions={dateFunctions}
                      placeholder={param.prompt || param.name}
                    />
                  ) : (
                    <input
                      type="text"
                      value={paramValues[param.name] || ''}
                      onChange={(e) => handleParamChange(param.name, e.target.value)}
                      placeholder={param.prompt || param.name}
                      className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Response Variable Name */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Response Variable
        </label>
        <input
          type="text"
          value={current.responseVariableName || ''}
          onChange={(e) => emit({ responseVariableName: e.target.value })}
          placeholder="e.g. orders_data"
          className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
          Name to reference this response in downstream nodes
        </p>
      </div>

      {/* Response Path */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Response Path (optional)
        </label>
        <input
          type="text"
          value={current.responsePath || ''}
          onChange={(e) => emit({ responsePath: e.target.value })}
          placeholder="e.g. data.results"
          className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
          Dot-path to extract nested data from the response
        </p>
      </div>

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
            { value: 'continue', label: 'Continue with empty data' },
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
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Input Variables Reference */}
      {inputVariables && inputVariables.length > 0 && (
        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
            Input Variables
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
            Use these in parameter values to reference data from the triggering action:
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
