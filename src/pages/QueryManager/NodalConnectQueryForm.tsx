import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Zap, AlertTriangle } from 'lucide-react';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useFixedValues } from '../../hooks/useFixedValues';
import { useAuth } from '../../contexts/AuthContext';
import { proxyFetch } from '../../lib/apiProxy';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type { Query, QueryType, QueryPurposeType, QueryAppTarget, UserParameter, UserParameterDataType, NodalDatabase, ApiEndpoint } from '../../types/database';

interface NodalConnectQueryFormProps {
  queryType: 'sql' | 'stored_procedure';
  query?: Query | null;
  onSave: (data: Partial<Query>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  saveError?: string;
  onClearError?: () => void;
}

const NC_PARAM_TYPE_MAP: Record<string, UserParameterDataType> = {
  'String': 'Text',
  'Int32': 'Integer',
  'Int64': 'Integer',
  'Decimal': 'Double',
  'Double': 'Double',
  'Float': 'Double',
  'Boolean': 'Boolean',
  'DateTime': 'Date',
  'Date': 'Date',
};

function mapNcParamType(ncType: string): UserParameterDataType {
  return NC_PARAM_TYPE_MAP[ncType] || 'Text';
}

function getEndpointAuthHeaders(endpoint: ApiEndpoint): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(endpoint.headers as Record<string, string> || {})
  };

  if (endpoint.auth_type === 'bearer') {
    const config = endpoint.auth_config as { token?: string } | null;
    if (config?.token) {
      headers['Authorization'] = `Bearer ${config.token}`;
      headers['X-API-Key'] = config.token;
    }
  } else if (endpoint.auth_type === 'api_key') {
    const config = endpoint.auth_config as { header_name?: string; api_key?: string } | null;
    if (config?.header_name && config?.api_key) {
      headers[config.header_name] = config.api_key;
    }
  } else if (endpoint.auth_type === 'basic') {
    const config = endpoint.auth_config as { username?: string; password?: string } | null;
    if (config?.username && config?.password) {
      headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
    }
  }

  return headers;
}

export default function NodalConnectQueryForm({
  queryType,
  query,
  onSave,
  onCancel,
  saving,
  saveError,
  onClearError
}: NodalConnectQueryFormProps) {
  const { endpoints, nodalDatabases } = useEndpoints();
  const { fixedValues } = useFixedValues();
  const { activeCompany } = useAuth();

  const nodalEndpoint = endpoints.find(e => e.endpoint_type === 'nodal_connect') || null;
  const availableDatabases = nodalDatabases.filter(db =>
    nodalEndpoint ? db.api_endpoint_id === nodalEndpoint.id : false
  );

  const [name, setName] = useState(query?.name || '');
  const [purposeType, setPurposeType] = useState<QueryPurposeType>(query?.purpose_type || 'query');
  const [appTarget, setAppTarget] = useState<QueryAppTarget>(query?.app_target || 'both');
  const [dbConnectionId, setDbConnectionId] = useState(query?.nodal_db_connection_id || '');
  const [sqlText, setSqlText] = useState(query?.sql_query_text || '');
  const [procName, setProcName] = useState(query?.proc_name || '');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [lookupValueField, setLookupValueField] = useState(query?.lookup_value_field || '');
  const [lookupLabelField, setLookupLabelField] = useState(query?.lookup_label_field || '');
  const [userParameters, setUserParameters] = useState<UserParameter[]>(
    (query?.user_parameters as UserParameter[]) || []
  );

  const [detectingParams, setDetectingParams] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [nameConflictChecking, setNameConflictChecking] = useState(false);

  useEffect(() => {
    if (query) {
      setName(query.name);
      setPurposeType(query.purpose_type);
      setAppTarget(query.app_target || 'both');
      setDbConnectionId(query.nodal_db_connection_id || '');
      setSqlText(query.sql_query_text || '');
      setProcName(query.proc_name || '');
      setLookupValueField(query.lookup_value_field || '');
      setLookupLabelField(query.lookup_label_field || '');
      setUserParameters((query.user_parameters as UserParameter[]) || []);
    }
  }, [query]);

  useEffect(() => {
    if (!query && !dbConnectionId && availableDatabases.length === 1) {
      setDbConnectionId(availableDatabases[0].connection_id);
    }
  }, [availableDatabases, query, dbConnectionId]);

  const handleDetectParams = async () => {
    if (!nodalEndpoint) return;

    setDetectingParams(true);
    setDetectError('');

    try {
      const headers = getEndpointAuthHeaders(nodalEndpoint);
      const url = `${nodalEndpoint.url.replace(/\/$/, '')}/executables/manage/detect-params`;

      const body: Record<string, unknown> = {
        executableType: queryType === 'sql' ? 'SQL_QUERY' : 'STORED_PROCEDURE',
        dbConnectionId: dbConnectionId,
      };

      if (queryType === 'sql') {
        body.sqlQueryText = sqlText.replace(/@(\w+)/g, ':$1');
      } else {
        body.procName = procName;
      }

      const response = await proxyFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.details || errorData?.message || errorData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const params = Array.isArray(data) ? data : (data?.parameters || data?.params || []);

      const detected: UserParameter[] = params.map((p: { name: string; type?: string; dataType?: string; required?: boolean; mode?: string }) => ({
        name: `@${p.name.replace(/^@/, '')}`,
        prompt: p.name.replace(/^@/, ''),
        dataType: mapNcParamType(p.type || p.dataType || 'String'),
      }));

      setUserParameters(detected);
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : 'Failed to detect parameters');
    } finally {
      setDetectingParams(false);
    }
  };

  const handleAddParameter = () => {
    setUserParameters(prev => [...prev, { name: '@param', prompt: 'param', dataType: 'Text' }]);
  };

  const handleRemoveParameter = (index: number) => {
    setUserParameters(prev => prev.filter((_, i) => i !== index));
  };

  const handleParamChange = (index: number, field: keyof UserParameter, value: string) => {
    setUserParameters(prev => prev.map((p, i) => {
      if (i !== index) return p;
      if (field === 'name') {
        const paramName = value.startsWith('@') ? value : `@${value}`;
        const stripped = value.replace(/^@/, '');
        const autoPrompt = p.name.replace(/^@/, '');
        const newPrompt = (!p.prompt || p.prompt === autoPrompt) ? stripped : p.prompt;
        return { ...p, name: paramName, prompt: newPrompt };
      }
      if (field === 'dataType') {
        const matchedFv = fixedValues.find(fv => fv.id === value);
        if (matchedFv) {
          return { ...p, dataType: value as UserParameter['dataType'], fixedValueId: matchedFv.id };
        }
        return { ...p, dataType: value as UserParameter['dataType'], fixedValueId: undefined };
      }
      return { ...p, [field]: value };
    }));
  };

  const handleSubmit = async () => {
    onClearError?.();
    setDetectError('');

    if (!nodalEndpoint) return;

    // Pre-save naming conflict check (only for new queries)
    if (!query && name.trim()) {
      setNameConflictChecking(true);
      try {
        const headers = getEndpointAuthHeaders(nodalEndpoint);
        const checkUrl = `${nodalEndpoint.url.replace(/\/$/, '')}/executables/manage/${encodeURIComponent(name.trim())}`;
        const checkResp = await proxyFetch(checkUrl, { method: 'GET', headers });
        if (checkResp.ok) {
          setNameConflictChecking(false);
          setDetectError('An executable with this name already exists on NodalConnect');
          return;
        }
      } catch {
        // If check fails, proceed with save
      }
      setNameConflictChecking(false);
    }

    // Create or update executable on NodalConnect server
    // Start with required fields only; add optional fields after validation
    const ncBody: Record<string, unknown> = {
      name: name.trim(),
      executableType: queryType === 'sql' ? 'SQL_QUERY' : 'STORED_PROCEDURE',
      dbConnectionId: dbConnectionId,
    };
    if (queryType === 'sql') {
      ncBody.sqlQueryText = sqlText.replace(/@(\w+)/g, ':$1');
    } else {
      ncBody.procName = procName;
    }
    // Optional fields - only include if they have meaningful values
    if (description.trim()) {
      ncBody.description = description.trim();
    }
    ncBody.active = isActive;
    if (userParameters.length > 0) {
      ncBody.paramDefinition = JSON.stringify(
        userParameters.map(p => ({
          name: p.name.replace(/^@/, ''),
          mode: 'IN',
          type: p.dataType === 'Integer' ? 'INTEGER' : p.dataType === 'Double' ? 'DECIMAL' : p.dataType === 'Date' ? 'DATETIME' : 'STRING',
          required: true,
        }))
      );
    }

    console.log('[NC Create] Request body:', JSON.stringify(ncBody, null, 2));

    try {
      const headers = getEndpointAuthHeaders(nodalEndpoint);
      const isEdit = !!query;
      const ncUrl = isEdit
        ? `${nodalEndpoint.url.replace(/\/$/, '')}/executables/manage/${encodeURIComponent(name.trim())}`
        : `${nodalEndpoint.url.replace(/\/$/, '')}/executables/manage`;
      const ncMethod = isEdit ? 'PUT' : 'POST';

      console.log('[NC Create] URL:', ncUrl, 'Method:', ncMethod);
      console.log('[NC Create] Headers:', JSON.stringify(headers, null, 2));

      const ncResp = await proxyFetch(ncUrl, {
        method: ncMethod,
        headers,
        body: JSON.stringify(ncBody)
      });

      if (!ncResp.ok) {
        const errText = await ncResp.text();
        console.log('[NC Create] Raw error response:', errText);
        let errData: Record<string, unknown> | null = null;
        try { errData = JSON.parse(errText); } catch { /* not JSON */ }
        const details = errData?.details;
        let parsedDetails = '';
        if (typeof details === 'string') {
          try {
            const d = JSON.parse(details);
            parsedDetails = d?.message || d?.error || details;
          } catch { parsedDetails = details; }
        }
        setDetectError(parsedDetails || (errData?.message as string) || (errData?.error as string) || `NodalConnect ${ncMethod} failed: ${ncResp.status}`);
        return;
      }
      console.log('[NC Create] Success!');
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : 'Failed to save to NodalConnect');
      return;
    }

    // Save locally
    const queryData: Partial<Query> = {
      name: name.trim(),
      query_type: queryType as QueryType,
      purpose_type: purposeType,
      app_target: appTarget,
      nodal_db_connection_id: dbConnectionId || null,
      sql_query_text: queryType === 'sql' ? sqlText : null,
      proc_name: queryType === 'stored_procedure' ? procName : null,
      user_parameters: userParameters as unknown as Query['user_parameters'],
      api_endpoint_id: nodalEndpoint?.id || null,
      http_method: 'POST',
      api_sub_path: 'executables/run',
      lookup_value_field: purposeType === 'lookup' ? (lookupValueField.trim() || null) : null,
      lookup_label_field: purposeType === 'lookup' ? (lookupLabelField.trim() || null) : null,
    };

    await onSave(queryData);

    // Fire-and-forget: detect result columns after save
    if (name.trim()) {
      detectResultColumns(name.trim(), nodalEndpoint);
    }
  };

  const detectResultColumns = async (queryName: string, endpoint: ApiEndpoint) => {
    try {
      const headers = getEndpointAuthHeaders(endpoint);
      let url: string;
      let method: string;
      let body: Record<string, unknown>;

      if (userParameters.length === 0) {
        url = `${endpoint.url.replace(/\/$/, '')}/executables/manage/detect-result-columns`;
        method = 'POST';
        body = {
          name: queryName,
          executableType: queryType === 'sql' ? 'SQL_QUERY' : 'STORED_PROCEDURE',
          dbConnectionId: dbConnectionId,
          ...(queryType === 'sql' ? { sqlQueryText: sqlText.replace(/@(\w+)/g, ':$1') } : { procName }),
        };
      } else {
        url = `${endpoint.url.replace(/\/$/, '')}/executables/manage/${encodeURIComponent(queryName)}/detect-result-columns`;
        method = 'PUT';
        body = {};
      }

      const response = await proxyFetch(url, { method, headers, body: JSON.stringify(body) });

      if (!response.ok) return;

      const data = await response.json();
      const columns: string[] = Array.isArray(data)
        ? data.map((c: { name?: string; columnName?: string }) => c.name || c.columnName || '')
        : (data?.columns || data?.resultColumns || []);

      const filteredCols = columns.filter(Boolean);
      if (filteredCols.length === 0) return;

      // Update the query's last_known_columns by name + company
      if (activeCompany?.id) {
        await supabase
          .from('queries')
          .update({ last_known_columns: filteredCols })
          .eq('name', queryName)
          .eq('company_id', activeCompany.id);
      }
    } catch {
      // Non-blocking - column detection is best-effort
    }
  };

  if (!nodalEndpoint) {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Nodal Connect Endpoint Configured
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
          To create {queryType === 'sql' ? 'SQL' : 'Stored Procedure'} queries, you need to configure a Nodal Connect endpoint in API Settings first.
        </p>
        <Button variant="secondary" onClick={onCancel}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {saveError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm">
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); onClearError?.(); }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder={queryType === 'sql' ? 'e.g. GetActiveOrders' : 'e.g. RunMonthlyReport'}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This becomes the executable name in NodalConnect
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Purpose Type
            </label>
            <CustomDropdown
              value={purposeType}
              onChange={(val) => setPurposeType(val as QueryPurposeType)}
              options={[
                { value: 'query', label: 'Query' },
                { value: 'action', label: 'Action' },
                { value: 'lookup', label: 'Lookup' },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Application <span className="text-red-500">*</span>
            </label>
            <CustomDropdown
              value={appTarget}
              onChange={(val) => setAppTarget(val as QueryAppTarget)}
              options={[
                { value: 'dashboard', label: 'Dashboard' },
                { value: 'pulse', label: 'Pulse' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </div>
        </div>

        {purposeType === 'lookup' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Value Field
              </label>
              <input
                type="text"
                value={lookupValueField}
                onChange={(e) => setLookupValueField(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="e.g. id"
              />
              <p className="text-xs text-gray-500 mt-1">Column used as the selected value</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Label Field
              </label>
              <input
                type="text"
                value={lookupLabelField}
                onChange={(e) => setLookupLabelField(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="e.g. name"
              />
              <p className="text-xs text-gray-500 mt-1">Column shown to the user</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Database Connection
        </label>
        {availableDatabases.length === 0 ? (
          <div className="px-3 py-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
            No database connections configured. Add connections in API Settings under the Nodal Connect endpoint.
          </div>
        ) : (
          <CustomDropdown
            value={dbConnectionId}
            onChange={setDbConnectionId}
            options={availableDatabases.map((db: NodalDatabase) => ({
              value: db.connection_id,
              label: `${db.name} (${db.connection_id})`
            }))}
            placeholder="Select a database connection..."
          />
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="Optional description of what this query does"
          />
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {queryType === 'sql' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            SQL Query
          </label>
          <textarea
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent font-mono text-sm dark:bg-gray-700 dark:text-white resize-y"
            rows={8}
            placeholder="SELECT * FROM Orders WHERE Status = @Status"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Use @ParameterName syntax for parameters
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Procedure Name
          </label>
          <input
            type="text"
            value={procName}
            onChange={(e) => setProcName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent font-mono dark:bg-gray-700 dark:text-white"
            placeholder="e.g. dbo.sp_GetActiveOrders"
          />
        </div>
      )}

      {/* Parameters Section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between rounded-t-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Parameters ({userParameters.length})
          </h4>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDetectParams}
              disabled={detectingParams || (!sqlText && queryType === 'sql') || (!procName && queryType === 'stored_procedure') || !dbConnectionId}
            >
              {detectingParams ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              Detect
            </Button>
            <Button size="sm" variant="secondary" onClick={handleAddParameter}>
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
        </div>

        {detectError && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {detectError}
          </div>
        )}

        {userParameters.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No parameters defined. Use "Detect" to auto-discover or "Add" to create manually.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {userParameters.map((param, idx) => (
              <div key={idx} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={param.name}
                      onChange={(e) => handleParamChange(idx, 'name', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white dark:bg-gray-700 dark:text-white"
                      placeholder="@paramName"
                    />
                  </div>
                  <div className="w-36">
                    <CustomDropdown
                      value={param.dataType}
                      onChange={(val) => handleParamChange(idx, 'dataType', val)}
                      options={[
                        { value: 'Text', label: 'Text' },
                        { value: 'Integer', label: 'Integer' },
                        { value: 'Double', label: 'Double' },
                        { value: 'Boolean', label: 'Boolean' },
                        { value: 'Date', label: 'Date' },
                        ...fixedValues.map(fv => ({
                          value: fv.id,
                          label: `Fixed: ${fv.name}`
                        }))
                      ]}
                      size="sm"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveParameter(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="pl-0">
                  <input
                    type="text"
                    value={param.prompt}
                    onChange={(e) => handleParamChange(idx, 'prompt', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white dark:bg-gray-700 dark:text-white text-gray-700 dark:text-gray-300"
                    placeholder="Prompt text shown to user (e.g. Enter the Vendor ID)"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={saving || nameConflictChecking}>
          {nameConflictChecking ? 'Checking...' : query ? 'Save Changes' : 'Create Query'}
        </Button>
      </div>
    </div>
  );
}
