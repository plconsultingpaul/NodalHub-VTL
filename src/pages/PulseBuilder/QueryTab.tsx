import { useMemo, useState, useEffect } from 'react';
import { Play, Loader2, AlertCircle, CheckCircle2, FunctionSquare } from 'lucide-react';
import { useQueries } from '../../hooks/useQueries';
import { useFixedValues } from '../../hooks/useFixedValues';
import { useLookupResolver } from '../../hooks/useLookupResolver';
import { useDateFunctions } from '../../hooks/useDateFunctions';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { proxyFetch } from '../../lib/apiProxy';
import { isDateFunctionRef, getDateFunctionId, makeDateFunctionRef, computeDateFunction } from '../../lib/dateFunctions';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import DatePicker from '../../components/ui/DatePicker';
import type { PulseInsert, PulseRunMode, QueryWithRelations, ApiEndpoint, UserParameter, FixedValueListItem, Json, RequestBodyFieldMapping } from '../../types/database';

interface QueryTabProps {
  draft: PulseInsert;
  onChange: (updates: Partial<PulseInsert>) => void;
}

interface TestResult {
  data?: unknown;
  error?: string;
  status?: number;
  fullUrl?: string;
}

const RUN_MODES: { value: PulseRunMode; label: string; description: string }[] = [
  {
    value: 'result_set',
    label: 'Result Set',
    description: 'Run once. Process the entire result as a single dataset.',
  },
  {
    value: 'per_row',
    label: 'Per Row',
    description: 'Run a downstream action once for each row returned.',
  },
  {
    value: 'per_group',
    label: 'Per Group',
    description: 'Group rows by a field, then run once per group.',
  },
];

const flattenRows = (data: unknown): Record<string, unknown>[] => {
  if (Array.isArray(data)) {
    return data.filter((r) => r && typeof r === 'object') as Record<string, unknown>[];
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === 'object') {
        return val.filter((r) => r && typeof r === 'object') as Record<string, unknown>[];
      }
    }
  }
  return [];
};

function substituteUserParameters(value: string, params: Record<string, string>): string {
  let result = value;
  Object.entries(params).forEach(([name, val]) => {
    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, val);
  });
  return result;
}

function substitutePathParameters(path: string, userParams: UserParameter[], paramValues: Record<string, string>): string {
  let result = path;
  userParams
    .filter(p => p.target === 'path')
    .forEach(param => {
      const paramName = param.name.replace(/^@/, '');
      const value = paramValues[param.name] || '';
      result = result.replace(new RegExp(`\\{${paramName}\\}`, 'g'), encodeURIComponent(value));
    });
  return result;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextArray = /^\d+$/.test(nextPart);
    if (!(part in current)) {
      current[part] = isNextArray ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function convertFieldValue(value: string, dataType: string): unknown {
  switch (dataType) {
    case 'integer': return parseInt(value, 10) || 0;
    case 'double': return parseFloat(value) || 0;
    case 'boolean': return value.toLowerCase() === 'true';
    default: return value;
  }
}

function DateParamInput({
  paramName,
  value,
  onChange,
  dateFunctions,
  placeholder,
}: {
  paramName: string;
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
    } else {
      if (dateFunctions.length > 0) {
        onChange(makeDateFunctionRef(dateFunctions[0].id));
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMode}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            isFnMode
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          title={isFnMode ? 'Switch to static date' : 'Use a date function'}
        >
          <FunctionSquare className="w-3 h-3" />
          {isFnMode ? 'Function' : 'fn'}
        </button>
        {dateFunctions.length === 0 && !isFnMode && (
          <span className="text-xs text-gray-400 dark:text-gray-500">No functions defined</span>
        )}
      </div>
      {isFnMode ? (
        <div className="space-y-1">
          <CustomDropdown
            value={selectedFnId}
            onChange={(v) => onChange(makeDateFunctionRef(v))}
            options={dateFunctions.map(f => ({
              value: f.id,
              label: f.name + (f.description ? ` - ${f.description}` : ''),
            }))}
            placeholder="Select a date function..."
          />
          {sampleValue && (
            <div className="text-xs text-blue-600 dark:text-blue-400 font-mono pl-1">
              Current value: {sampleValue}
            </div>
          )}
        </div>
      ) : (
        <DatePicker
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export default function QueryTab({ draft, onChange }: QueryTabProps) {
  const { queries } = useQueries();
  const { fixedValues, getResolvedValue } = useFixedValues();
  const { resolveLookup, getLookupState } = useLookupResolver();
  const { dateFunctions } = useDateFunctions();
  const { isDark } = useTheme();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const selectedQuery = useMemo<QueryWithRelations | null>(() => {
    if (!draft.query_id) return null;
    return queries.find((q) => q.id === draft.query_id) || null;
  }, [draft.query_id, queries]);

  const userParams = useMemo<UserParameter[]>(() => {
    if (!selectedQuery?.user_parameters) return [];
    return (selectedQuery.user_parameters as UserParameter[]) || [];
  }, [selectedQuery]);

  const paramValues = (draft.parameter_values || {}) as Record<string, string>;

  useEffect(() => {
    if (userParams.length === 0) return;
    const current = (draft.parameter_values || {}) as Record<string, string>;
    const updated: Record<string, string> = { ...current };
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
      onChange({ parameter_values: updated });
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

  const rows = useMemo(() => flattenRows(result?.data), [result]);
  const columns = useMemo(() => {
    if (!rows.length) return [] as string[];
    const cols = new Set<string>();
    rows.slice(0, 20).forEach((r) => Object.keys(r).forEach((k) => cols.add(k)));
    return Array.from(cols);
  }, [rows]);

  const handleParamChange = (name: string, value: string) => {
    onChange({ parameter_values: { ...paramValues, [name]: value } });
  };

  const handleTest = async () => {
    if (!selectedQuery || !selectedQuery.api_endpoints) return;
    setTesting(true);
    setResult(null);

    const resolvedParamValues: Record<string, string> = {};
    Object.entries(paramValues).forEach(([key, val]) => {
      if (isDateFunctionRef(val)) {
        const fnId = getDateFunctionId(val);
        const fn = dateFunctions.find(f => f.id === fnId);
        resolvedParamValues[key] = fn
          ? computeDateFunction(fn.base_date as Parameters<typeof computeDateFunction>[0], fn.string_format, fn.adjust_years, fn.adjust_months, fn.adjust_days)
          : '';
      } else {
        resolvedParamValues[key] = val;
      }
    });

    const endpoint = selectedQuery.api_endpoints as ApiEndpoint;
    const substitutedSubPath = substitutePathParameters(
      selectedQuery.api_sub_path || '',
      userParams,
      resolvedParamValues
    );

    let url = endpoint.url.replace(/\/$/, '');
    const normalizedSubPath = substitutedSubPath.replace(/^\//, '').replace(/\/$/, '');
    if (normalizedSubPath) {
      url = `${url}/${normalizedSubPath}`;
    }

    const queryParams = selectedQuery.query_parameters as Array<{ key: string; value: string; enabled: boolean }> | null;
    const enabledParams = queryParams?.filter(p => p.enabled && p.value);

    if (selectedQuery.url_query_string) {
      url += '?' + substituteUserParameters(selectedQuery.url_query_string, resolvedParamValues);
    } else if (enabledParams && enabledParams.length > 0) {
      const paramString = enabledParams
        .map(p => {
          const substitutedValue = substituteUserParameters(p.value, resolvedParamValues);
          return `${encodeURIComponent(p.key)}=${encodeURIComponent(substitutedValue)}`;
        })
        .join('&');
      url += '?' + paramString;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(endpoint.headers as Record<string, string> || {})
    };

    if (endpoint.auth_type === 'bearer') {
      const config = endpoint.auth_config as { token?: string };
      if (config?.token) headers['Authorization'] = `Bearer ${config.token}`;
    } else if (endpoint.auth_type === 'api_key') {
      const config = endpoint.auth_config as { header_name?: string; api_key?: string };
      if (config?.header_name && config?.api_key) headers[config.header_name] = config.api_key;
    } else if (endpoint.auth_type === 'basic') {
      const config = endpoint.auth_config as { username?: string; password?: string };
      if (config?.username && config?.password) {
        headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
      }
    }

    try {
      const fetchOptions: { method: string; headers: Record<string, string>; body?: string } = {
        method: selectedQuery.http_method,
        headers
      };

      if (['POST', 'PUT', 'PATCH'].includes(selectedQuery.http_method)) {
        if (selectedQuery.request_body_template) {
          try {
            const body = JSON.parse(selectedQuery.request_body_template);
            const mappings = (selectedQuery.request_body_field_mappings || []) as RequestBodyFieldMapping[];
            mappings.forEach(mapping => {
              let resolvedValue = mapping.value;
              if (mapping.type === 'parameter' && mapping.value) {
                resolvedValue = resolvedParamValues[mapping.value] || '';
              } else if (mapping.type === 'hardcoded') {
                resolvedValue = substituteUserParameters(resolvedValue, resolvedParamValues);
              }
              const typedValue = convertFieldValue(resolvedValue, mapping.dataType);
              setNestedValue(body, mapping.fieldName, typedValue);
            });
            fetchOptions.body = JSON.stringify(body);
          } catch {
            // fall through to json_parameters
          }
        }
        if (!fetchOptions.body) {
          const jsonParams = (selectedQuery.json_parameters || {}) as Record<string, unknown>;
          if (Object.keys(jsonParams).length > 0) {
            fetchOptions.body = JSON.stringify(jsonParams);
          }
        }
      }

      const response = await proxyFetch(url, fetchOptions);
      const data = await response.json();
      setResult({ data, status: response.status, fullUrl: url });

      const flatRows = flattenRows(data);
      if (flatRows.length > 0 && selectedQuery) {
        const cols = Array.from(new Set(flatRows.slice(0, 20).flatMap(r => Object.keys(r))));
        supabase.from('queries').update({ last_known_columns: cols }).eq('id', selectedQuery.id).then(() => {});
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Failed to test query' });
    }

    setTesting(false);
  };

  const runMode = (draft.run_mode || 'result_set') as PulseRunMode;

  return (
    <div className="space-y-6">
      <div className="space-y-6 max-w-3xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Query <span className="text-red-500">*</span>
          </label>
          <CustomDropdown
            value={draft.query_id || ''}
            onChange={(val) => onChange({ query_id: val || null, parameter_values: {} })}
            options={queries.filter(q => q.app_target === 'pulse' || q.app_target === 'both').map((q) => ({ value: q.id, label: q.name }))}
            placeholder="Select a query..."
            dark={isDark}
          />
          {selectedQuery?.api_endpoints && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {selectedQuery.http_method} {selectedQuery.api_endpoints.name}
              {selectedQuery.api_sub_path ? ` / ${selectedQuery.api_sub_path}` : ''}
            </p>
          )}
        </div>

        {userParams.length > 0 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Parameters
            </label>
            <div className="space-y-3">
              {userParams.map((param) => {
                const linkedFixedValue = param.fixedValueId
                  ? fixedValues.find(fv => fv.id === param.fixedValueId)
                  : null;

                if (linkedFixedValue?.value_type === 'lookup') {
                  const lookupState = getLookupState(linkedFixedValue.id);
                  return (
                    <div key={param.name}>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {param.prompt || param.name}
                      </label>
                      {lookupState.loading ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading options...
                        </div>
                      ) : lookupState.error ? (
                        <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                          {lookupState.error}
                        </div>
                      ) : (
                        <CustomDropdown
                          value={paramValues[param.name] || ''}
                          onChange={(val) => handleParamChange(param.name, val)}
                          options={lookupState.options}
                          placeholder={`Select ${linkedFixedValue?.name || param.name}...`}
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
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
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
                        placeholder={`Select ${linkedFixedValue?.name || param.name}...`}
                        dark={isDark}
                      />
                    ) : (param.dataType === 'Date' || param.dataType === 'Date (Fixed)') ? (
                      <DateParamInput
                        paramName={param.name}
                        value={paramValues[param.name] || ''}
                        onChange={(v) => handleParamChange(param.name, v)}
                        dateFunctions={dateFunctions}
                        placeholder={`Select ${param.prompt || param.name}`}
                      />
                    ) : (
                      <input
                        type="text"
                        value={paramValues[param.name] || ''}
                        onChange={(e) => handleParamChange(param.name, e.target.value)}
                        placeholder={`Enter ${param.prompt || param.name}`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              These values will be substituted into the query when the pulse runs.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Run Mode
          </label>
          <div className="space-y-2">
            {RUN_MODES.map((mode) => (
              <label
                key={mode.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  runMode === mode.value
                    ? 'border-black bg-gray-50 dark:border-white dark:bg-gray-700'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="run_mode"
                  value={mode.value}
                  checked={runMode === mode.value}
                  onChange={() => onChange({ run_mode: mode.value })}
                  className="mt-1 accent-black dark:accent-white"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{mode.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{mode.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {runMode === 'per_group' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Group By Field <span className="text-red-500">*</span>
            </label>
            {columns.length > 0 ? (
              <CustomDropdown
                value={draft.group_by_field || ''}
                onChange={(val) => onChange({ group_by_field: val || null })}
                options={columns.map((col) => ({ value: col, label: col }))}
                placeholder="Select a column..."
                dark={isDark}
              />
            ) : (
              <input
                type="text"
                value={draft.group_by_field || ''}
                onChange={(e) => onChange({ group_by_field: e.target.value || null })}
                placeholder="Run a test below to see column suggestions"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleTest} disabled={!selectedQuery || testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Test Query
          </Button>
          {result?.status != null && (
            <span
              className={`inline-flex items-center gap-1.5 text-sm ${
                result.status >= 200 && result.status < 300
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {result.status >= 200 && result.status < 300 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              Status {result.status} · {rows.length} row{rows.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {result?.fullUrl && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">URL</p>
            <p className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all">{result.fullUrl}</p>
          </div>
        )}

        {result?.error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{result.error}</p>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Test Results</p>
          </div>
          <div className="overflow-auto" style={{ maxHeight: 480 }}>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="even:bg-gray-50 dark:even:bg-gray-800/50">
                    {columns.map((col) => {
                      const val = (row as Record<string, Json>)[col];
                      const display =
                        val === null || val === undefined
                          ? ''
                          : typeof val === 'object'
                          ? JSON.stringify(val)
                          : String(val);
                      return (
                        <td
                          key={col}
                          className="px-3 py-1.5 text-gray-900 dark:text-gray-100 truncate max-w-xs"
                          title={display}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                Showing first 50 of {rows.length} rows
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
