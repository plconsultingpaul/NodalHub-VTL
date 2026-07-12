import { useState, useMemo, useRef, useCallback } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { Plus, Pencil, Trash2, Database, Globe, FileCode, Play, Loader2, CheckCircle, XCircle, Copy, Hash, AlertTriangle, Download, RefreshCw, ChevronDown, ChevronRight, LayoutDashboard, FolderPlus } from 'lucide-react';
import { useQueries } from '../../hooks/useQueries';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../contexts/ProjectsContext';
import { useFixedValues } from '../../hooks/useFixedValues';
import { useLookupResolver } from '../../hooks/useLookupResolver';
import { supabase } from '../../lib/supabase';
import { proxyFetch } from '../../lib/apiProxy';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import DatePicker from '../../components/ui/DatePicker';
import Dropdown, { DropdownItem, DropdownDivider } from '../../components/ui/Dropdown';
import PageHeader from '../../components/ui/PageHeader';
import ApiEndpointQueryForm from './ApiEndpointQueryForm';
import NodalConnectQueryForm from './NodalConnectQueryForm';
import ImportNodalModal from './ImportNodalModal';
import FixedValuesModal from './FixedValuesModal';
import type { Query, QueryType, QueryPurposeType, QueryWithRelations, ApiEndpoint, UserParameter, RequestBodyFieldMapping } from '../../types/database';

const QUERY_TYPE_CONFIG: Record<QueryType, { label: string; icon: typeof Globe; color: string }> = {
  api_endpoint: { label: 'API Endpoint', icon: Globe, color: 'bg-blue-100 text-blue-800' },
  sql: { label: 'SQL Query', icon: Database, color: 'bg-green-100 text-green-800' },
  stored_procedure: { label: 'Stored Procedure', icon: FileCode, color: 'bg-orange-100 text-orange-800' }
};

const getMethodBadgeClasses = (method: string) => {
  switch (method) {
    case 'GET': return 'bg-blue-100 text-blue-700';
    case 'POST': return 'bg-green-100 text-green-700';
    case 'PUT': return 'bg-yellow-100 text-yellow-700';
    case 'PATCH': return 'bg-orange-100 text-orange-700';
    case 'DELETE': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const FOLDER_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'
];

export default function QueryManager() {
  const { queries, loading, createQuery, updateQuery, deleteQuery } = useQueries();
  const { endpoints, nodalDatabases } = useEndpoints();
  const { activeCompany, user } = useAuth();
  const { projects, createProject, createDashboard } = useProjects();
  const { fixedValues, getResolvedValue } = useFixedValues();
  const { resolveLookup, getLookupState } = useLookupResolver();

  const nodalEndpoint = useMemo(() => endpoints.find(e => e.endpoint_type === 'nodal_connect') || null, [endpoints]);

  const [showModal, setShowModal] = useState(false);
  const [editingQuery, setEditingQuery] = useState<Query | null>(null);
  const [selectedType, setSelectedType] = useState<QueryType>('api_endpoint');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletingNodalQuery, setDeletingNodalQuery] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState('');
  const [testingQuery, setTestingQuery] = useState<QueryWithRelations | null>(null);
  const [testResult, setTestResult] = useState<{ status: number; data: unknown; error?: string; url?: string; body?: string | null } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [copyingQuery, setCopyingQuery] = useState<Query | null>(null);
  const [copyName, setCopyName] = useState('');
  const [copyError, setCopyError] = useState('');
  const [showFixedValues, setShowFixedValues] = useState(false);
  const [showParamPrompt, setShowParamPrompt] = useState(false);
  const [pendingTestQuery, setPendingTestQuery] = useState<QueryWithRelations | null>(null);
  const [testParamValues, setTestParamValues] = useState<Record<string, string>>({});
  const [purposeTypeFilter, setPurposeTypeFilter] = useState<'all' | QueryPurposeType>('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshingQueryId, setRefreshingQueryId] = useState<string | null>(null);
  const [testResponseExpanded, setTestResponseExpanded] = useState(false);
  const [testCopied, setTestCopied] = useState(false);
  const testTabulatorRef = useRef<Tabulator | null>(null);

  // Create Dashboard from Query state
  const [showCreateDashboard, setShowCreateDashboard] = useState(false);
  const [createDashboardQueryId, setCreateDashboardQueryId] = useState<string | null>(null);
  const [createDashboardName, setCreateDashboardName] = useState('');
  const [createDashboardFolderId, setCreateDashboardFolderId] = useState('');
  const [createDashboardError, setCreateDashboardError] = useState('');
  const [creatingDashboard, setCreatingDashboard] = useState(false);
  const [showNewFolderInline, setShowNewFolderInline] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const [dashboardCreatedId, setDashboardCreatedId] = useState<string | null>(null);

  const filteredQueries = useMemo(() => {
    if (purposeTypeFilter === 'all') return queries;
    return queries.filter(q => q.purpose_type === purposeTypeFilter);
  }, [queries, purposeTypeFilter]);

  const dashboardFolders = useMemo(() =>
    projects.filter(p => p.type === 'dashboards'),
    [projects]
  );

  const handleOpenCreateDashboard = (query: Query) => {
    setCreateDashboardQueryId(query.id);
    setCreateDashboardName(query.name);
    setCreateDashboardFolderId(dashboardFolders.length > 0 ? dashboardFolders[0].id : '');
    setCreateDashboardError('');
    setShowNewFolderInline(false);
    setNewFolderName('');
    setNewFolderColor('#3B82F6');
    setDashboardCreatedId(null);
    setShowCreateDashboard(true);
  };

  const handleCloseCreateDashboard = () => {
    setShowCreateDashboard(false);
    setCreateDashboardQueryId(null);
    setCreateDashboardName('');
    setCreateDashboardFolderId('');
    setCreateDashboardError('');
    setShowNewFolderInline(false);
    setDashboardCreatedId(null);
  };

  const handleCreateDashboardSubmit = async () => {
    const trimmedName = createDashboardName.trim();
    if (!trimmedName) {
      setCreateDashboardError('Dashboard name is required');
      return;
    }
    if (!activeCompany || !user) {
      setCreateDashboardError('Not authenticated');
      return;
    }

    setCreatingDashboard(true);
    setCreateDashboardError('');

    let targetFolderId = createDashboardFolderId;

    if (showNewFolderInline) {
      const folderName = newFolderName.trim();
      if (!folderName) {
        setCreateDashboardError('Folder name is required');
        setCreatingDashboard(false);
        return;
      }
      const folderResult = await createProject(folderName, newFolderColor, 'dashboards');
      if (folderResult.error) {
        setCreateDashboardError(folderResult.error);
        setCreatingDashboard(false);
        return;
      }
      targetFolderId = folderResult.data!.id;
    }

    if (!targetFolderId) {
      setCreateDashboardError('Please select a folder or create a new one');
      setCreatingDashboard(false);
      return;
    }

    const dashResult = await createDashboard(trimmedName, targetFolderId);
    if (dashResult.error) {
      setCreateDashboardError(dashResult.error);
      setCreatingDashboard(false);
      return;
    }

    const newDashboardId = dashResult.data!.id;

    const { error: cellError } = await supabase
      .from('dashboard_cells')
      .insert({
        dashboard_id: newDashboardId,
        query_id: createDashboardQueryId,
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
        settings: {}
      });

    if (cellError) {
      setCreateDashboardError(cellError.message);
      setCreatingDashboard(false);
      return;
    }

    setCreatingDashboard(false);
    setDashboardCreatedId(newDashboardId);
  };

  const handleCreate = (type: QueryType) => {
    setSelectedType(type);
    setEditingQuery(null);
    setShowModal(true);
  };

  const handleEdit = (query: Query) => {
    setSelectedType(query.query_type);
    setEditingQuery(query);
    setShowModal(true);
  };

  const [saveError, setSaveError] = useState('');

  const handleSave = async (data: Partial<Query>) => {
    const trimmedName = data.name?.trim();
    if (!trimmedName) {
      setSaveError('Name is required');
      return;
    }

    const nameExists = queries.some(q =>
      q.name.toLowerCase() === trimmedName.toLowerCase() &&
      q.id !== editingQuery?.id
    );
    if (nameExists) {
      setSaveError('A query with this name already exists');
      return;
    }

    setSaving(true);
    setSaveError('');

    console.log('[QueryManager.handleSave] Saving query:', { editing: !!editingQuery, data });

    let result: { error?: string | null; data?: Query } | undefined;

    if (editingQuery) {
      result = await updateQuery(editingQuery.id, data);
    } else {
      result = await createQuery(data as Omit<Query, 'id' | 'created_at' | 'updated_at' | 'company_id' | 'created_by'>);
    }

    console.log('[QueryManager.handleSave] Save result:', result);

    setSaving(false);

    if (result?.error) {
      setSaveError(result.error);
      return;
    }

    setShowModal(false);
    setEditingQuery(null);

    // For new queries with purpose_type 'query', offer to create a dashboard
    if (!editingQuery && result?.data && (data.purpose_type === 'query' || !data.purpose_type)) {
      const newQuery = result.data as Query;
      setCreateDashboardQueryId(newQuery.id);
      setCreateDashboardName(newQuery.name);
      setCreateDashboardFolderId(dashboardFolders.length > 0 ? dashboardFolders[0].id : '');
      setCreateDashboardError('');
      setShowNewFolderInline(false);
      setNewFolderName('');
      setNewFolderColor('#3B82F6');
      setDashboardCreatedId(null);
      setShowCreateDashboard(true);
    }
  };

  const handleDelete = async (id: string) => {
    const queryToDelete = queries.find(q => q.id === id);
    const isNodalQuery = queryToDelete && (queryToDelete.query_type === 'sql' || queryToDelete.query_type === 'stored_procedure');

    if (isNodalQuery && nodalEndpoint && queryToDelete) {
      setDeletingNodalQuery(true);
      setDeleteWarning('');

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(nodalEndpoint.headers as Record<string, string> || {})
        };

        if (nodalEndpoint.auth_type === 'bearer') {
          const config = nodalEndpoint.auth_config as { token?: string } | null;
          if (config?.token) headers['Authorization'] = `Bearer ${config.token}`;
        } else if (nodalEndpoint.auth_type === 'api_key') {
          const config = nodalEndpoint.auth_config as { header_name?: string; api_key?: string } | null;
          if (config?.header_name && config?.api_key) headers[config.header_name] = config.api_key;
        } else if (nodalEndpoint.auth_type === 'basic') {
          const config = nodalEndpoint.auth_config as { username?: string; password?: string } | null;
          if (config?.username && config?.password) headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
        }

        const url = `${nodalEndpoint.url.replace(/\/$/, '')}/executables/manage/${encodeURIComponent(queryToDelete.name)}`;
        const response = await proxyFetch(url, { method: 'DELETE', headers });

        if (!response.ok && response.status !== 404) {
          setDeleteWarning('NodalConnect executable could not be removed, but local query was deleted.');
        }
      } catch {
        setDeleteWarning('Failed to contact NodalConnect, but local query was deleted.');
      }

      setDeletingNodalQuery(false);
    }

    await deleteQuery(id);
    setShowDeleteConfirm(null);
    if (deleteWarning) {
      setTimeout(() => setDeleteWarning(''), 5000);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingQuery(null);
    setSaveError('');
  };

  const handleTest = (query: QueryWithRelations) => {
    const userParams = (query.user_parameters as UserParameter[]) || [];

    if (userParams.length > 0) {
      const initialValues: Record<string, string> = {};
      userParams.forEach(p => {
        const fvId = p.fixedValueId || fixedValues.find(fv => fv.id === p.dataType)?.id;
        if (fvId) {
          const fv = fixedValues.find(v => v.id === fvId);
          if (fv) {
            if (fv.value_type === 'lookup') {
              resolveLookup(fv);
              initialValues[p.name] = '';
            } else {
              initialValues[p.name] = getResolvedValue(fv) || '';
            }
          }
        } else {
          initialValues[p.name] = '';
        }
      });
      setTestParamValues(initialValues);
      setPendingTestQuery(query);
      setShowParamPrompt(true);
    } else {
      runTest(query, {});
    }
  };

  const substituteUserParameters = (value: string, params: Record<string, string>): string => {
    let result = value;
    Object.entries(params).forEach(([name, val]) => {
      const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      result = result.replace(regex, val);
    });
    return result;
  };

  const substitutePathParameters = (path: string, userParams: UserParameter[], paramValues: Record<string, string>): string => {
    let result = path;
    userParams
      .filter(p => p.target === 'path')
      .forEach(param => {
        const paramName = param.name.replace(/^@/, '');
        const value = paramValues[param.name] || '';
        result = result.replace(new RegExp(`\\{${paramName}\\}`, 'g'), encodeURIComponent(value));
      });
    return result;
  };

  const buildRequestBody = (
    template: string | null,
    fieldMappings: RequestBodyFieldMapping[],
    paramValues: Record<string, string>
  ): object | null => {
    if (!template) return null;

    try {
      const body = JSON.parse(template);

      const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown) => {
        const parts = path.split(/\.|\[(\d+)\]/).filter(Boolean);
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const nextPart = parts[i + 1];
          const isNextArray = /^\d+$/.test(nextPart);

          if (!(part in current)) {
            current[part] = isNextArray ? [] : {};
          }
          current = current[part] as Record<string, unknown>;
        }

        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
      };

      const convertValue = (value: string, dataType: string): unknown => {
        switch (dataType) {
          case 'integer':
            return parseInt(value, 10) || 0;
          case 'double':
            return parseFloat(value) || 0;
          case 'boolean':
            return value.toLowerCase() === 'true';
          default:
            return value;
        }
      };

      fieldMappings.forEach(mapping => {
        let resolvedValue = mapping.value;

        if (mapping.type === 'parameter' && mapping.value) {
          resolvedValue = paramValues[mapping.value] || '';
        }

        const typedValue = convertValue(resolvedValue, mapping.dataType);
        setNestedValue(body, mapping.fieldName, typedValue);
      });

      return body;
    } catch {
      return null;
    }
  };

  const runTest = async (query: QueryWithRelations, paramValues: Record<string, string>) => {
    setTestingQuery(query);
    setTestResult(null);
    setTestLoading(true);
    setShowParamPrompt(false);
    setPendingTestQuery(null);

    // NodalConnect SQL/SP execution path
    if ((query.query_type === 'sql' || query.query_type === 'stored_procedure') && nodalEndpoint) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(nodalEndpoint.headers as Record<string, string> || {})
      };

      if (nodalEndpoint.auth_type === 'bearer') {
        const config = nodalEndpoint.auth_config as { token?: string } | null;
        if (config?.token) headers['Authorization'] = `Bearer ${config.token}`;
      } else if (nodalEndpoint.auth_type === 'api_key') {
        const config = nodalEndpoint.auth_config as { header_name?: string; api_key?: string } | null;
        if (config?.header_name && config?.api_key) headers[config.header_name] = config.api_key;
      } else if (nodalEndpoint.auth_type === 'basic') {
        const config = nodalEndpoint.auth_config as { username?: string; password?: string } | null;
        if (config?.username && config?.password) headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
      }

      const url = `${nodalEndpoint.url.replace(/\/$/, '')}/executables/run`;
      const inputs: Record<string, string> = {};
      Object.entries(paramValues).forEach(([key, val]) => {
        inputs[key.replace(/^@/, '')] = val;
      });

      const requestBody = { name: query.name, inputs };
      const requestBodyString = JSON.stringify(requestBody, null, 2);

      try {
        const response = await proxyFetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        setTestResult({ status: response.status, data, url, body: requestBodyString });

        // Extract rows and save last_known_columns
        const rows = data?.result?.rows || data?.rows || (Array.isArray(data) ? data : []);
        if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
          const cols = Array.from(new Set((rows as Record<string, unknown>[]).slice(0, 20).flatMap(r => Object.keys(r))));
          if (cols.length > 0) {
            supabase.from('queries').update({ last_known_columns: cols }).eq('id', query.id).then(() => {});
          }
        }
      } catch (err) {
        setTestResult({
          status: 0,
          data: null,
          error: err instanceof Error ? err.message : 'Failed to execute request',
          url,
          body: requestBodyString
        });
      } finally {
        setTestLoading(false);
      }
      return;
    }

    // Standard API endpoint execution path
    const endpoint = query.api_endpoints as ApiEndpoint | undefined;
    if (!endpoint) {
      setTestResult({ status: 0, data: null, error: 'No endpoint configured for this query' });
      setTestLoading(false);
      return;
    }

    const userParams = (query.user_parameters as UserParameter[]) || [];
    const substitutedSubPath = substitutePathParameters(query.api_sub_path, userParams, paramValues);

    let url = endpoint.url;
    if (substitutedSubPath) {
      url = url.replace(/\/$/, '') + '/' + substitutedSubPath.replace(/^\//, '').replace(/\/$/, '');
    }

    const queryParams = query.query_parameters as Array<{ key: string; value: string; enabled: boolean }> | null;
    const enabledParams = queryParams?.filter(p => p.enabled && p.value);

    if (enabledParams && enabledParams.length > 0) {
      const paramString = enabledParams
        .map(p => {
          const substitutedValue = substituteUserParameters(p.value, paramValues);
          return `${encodeURIComponent(p.key)}=${encodeURIComponent(substitutedValue)}`;
        })
        .join('&');
      url += (url.includes('?') ? '&' : '?') + paramString;
    } else if (query.url_query_string) {
      const substitutedQueryString = substituteUserParameters(query.url_query_string, paramValues);
      url += (url.includes('?') ? '&' : '?') + substitutedQueryString;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(endpoint.headers as Record<string, string> || {})
    };

    if (endpoint.auth_type === 'bearer') {
      const authConfig = endpoint.auth_config as { token?: string } | null;
      if (authConfig?.token) {
        headers['Authorization'] = `Bearer ${authConfig.token}`;
      }
    } else if (endpoint.auth_type === 'api_key') {
      const authConfig = endpoint.auth_config as { header_name?: string; api_key?: string } | null;
      if (authConfig?.header_name && authConfig?.api_key) {
        headers[authConfig.header_name] = authConfig.api_key;
      }
    } else if (endpoint.auth_type === 'basic') {
      const authConfig = endpoint.auth_config as { username?: string; password?: string } | null;
      if (authConfig?.username && authConfig?.password) {
        headers['Authorization'] = `Basic ${btoa(`${authConfig.username}:${authConfig.password}`)}`;
      }
    }

    let requestBodyString: string | null = null;

    try {
      const fetchOptions: RequestInit = {
        method: query.http_method,
        headers
      };

      if (['POST', 'PUT', 'PATCH'].includes(query.http_method)) {
        const fieldMappings = (query.request_body_field_mappings as RequestBodyFieldMapping[]) || [];
        const requestBody = buildRequestBody(query.request_body_template, fieldMappings, paramValues);
        if (requestBody) {
          requestBodyString = JSON.stringify(requestBody, null, 2);
          fetchOptions.body = JSON.stringify(requestBody);
        } else if (query.json_parameters) {
          requestBodyString = JSON.stringify(query.json_parameters, null, 2);
          fetchOptions.body = JSON.stringify(query.json_parameters);
        }
      }

      const response = await proxyFetch(url, {
        method: query.http_method,
        headers,
        body: fetchOptions.body as string | undefined,
      });
      const data = await response.json();

      setTestResult({ status: response.status, data, url, body: requestBodyString });

      // Save last_known_columns from result
      const rows = Array.isArray(data) ? data : (data && typeof data === 'object' && Array.isArray(Object.values(data)[0])) ? Object.values(data)[0] as unknown[] : [];
      if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
        const cols = Array.from(new Set((rows as Record<string, unknown>[]).slice(0, 20).flatMap(r => Object.keys(r))));
        if (cols.length > 0) {
          supabase.from('queries').update({ last_known_columns: cols }).eq('id', query.id).then(() => {});
        }
      }
    } catch (err) {
      setTestResult({
        status: 0,
        data: null,
        error: err instanceof Error ? err.message : 'Failed to execute request',
        url,
        body: requestBodyString
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleParamSubmit = () => {
    if (pendingTestQuery) {
      runTest(pendingTestQuery, testParamValues);
    }
  };

  const handleCloseParamPrompt = () => {
    setShowParamPrompt(false);
    setPendingTestQuery(null);
    setTestParamValues({});
  };

  const handleCloseTest = () => {
    setTestingQuery(null);
    setTestResult(null);
    setTestResponseExpanded(false);
    setTestCopied(false);
    if (testTabulatorRef.current) {
      testTabulatorRef.current.destroy();
      testTabulatorRef.current = null;
    }
  };

  const getTestResultRows = useCallback((): Record<string, unknown>[] => {
    if (!testResult?.data) return [];
    const data = testResult.data as Record<string, unknown>;
    const rows = data?.result?.rows || data?.rows || (Array.isArray(testResult.data) ? testResult.data : []);
    if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
      return rows as Record<string, unknown>[];
    }
    return [];
  }, [testResult]);

  const testGridCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (testTabulatorRef.current) {
      testTabulatorRef.current.destroy();
      testTabulatorRef.current = null;
    }
    if (!node) return;

    const rows = getTestResultRows();
    if (rows.length === 0) return;

    const cols = Array.from(new Set(rows.slice(0, 50).flatMap(r => Object.keys(r))));
    const columns = cols.map(field => ({
      title: field,
      field,
      headerSort: true,
      resizable: true,
    }));

    testTabulatorRef.current = new Tabulator(node, {
      data: rows,
      columns,
      layout: 'fitDataFill',
      height: Math.min(rows.length * 32 + 42, 320),
      movableColumns: false,
      placeholder: 'No data',
      rowHeight: 28,
    });
  }, [getTestResultRows]);

  const handleCopyTestResult = () => {
    if (!testResult?.data) return;
    const text = typeof testResult.data === 'string'
      ? testResult.data
      : JSON.stringify(testResult.data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setTestCopied(true);
      setTimeout(() => setTestCopied(false), 2000);
    });
  };

  const handleStartCopy = (query: Query) => {
    setCopyingQuery(query);
    setCopyName(`${query.name} (Copy)`);
    setCopyError('');
  };

  const handleCloseCopy = () => {
    setCopyingQuery(null);
    setCopyName('');
    setCopyError('');
  };

  const handleCopy = async () => {
    if (!copyingQuery) return;

    const trimmedName = copyName.trim();
    if (!trimmedName) {
      setCopyError('Name is required');
      return;
    }

    const nameExists = queries.some(q => q.name.toLowerCase() === trimmedName.toLowerCase());
    if (nameExists) {
      setCopyError('A query with this name already exists');
      return;
    }

    setSaving(true);
    setCopyError('');

    const { id, created_at, updated_at, company_id, created_by, api_endpoints, api_spec_endpoints, ...queryData } = copyingQuery;
    const result = await createQuery({
      ...queryData,
      name: trimmedName
    });

    setSaving(false);

    if (result.error) {
      setCopyError(result.error);
    } else {
      handleCloseCopy();
    }
  };

  const handleImportExecutables = async (queriesToImport: Partial<Query>[]) => {
    const errors: string[] = [];
    for (const queryData of queriesToImport) {
      const result = await createQuery(queryData as Omit<Query, 'id' | 'created_at' | 'updated_at' | 'company_id' | 'created_by'>);
      if (result?.error) {
        errors.push(`${queryData.name}: ${result.error}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
  };

  const handleRefreshFromNodal = async (query: Query) => {
    if (!nodalEndpoint) return;
    setRefreshingQueryId(query.id);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(nodalEndpoint.headers as Record<string, string> || {})
      };
      if (nodalEndpoint.auth_type === 'bearer') {
        const config = nodalEndpoint.auth_config as { token?: string } | null;
        if (config?.token) headers['Authorization'] = `Bearer ${config.token}`;
      } else if (nodalEndpoint.auth_type === 'api_key') {
        const config = nodalEndpoint.auth_config as { header_name?: string; api_key?: string } | null;
        if (config?.header_name && config?.api_key) headers[config.header_name] = config.api_key;
      } else if (nodalEndpoint.auth_type === 'basic') {
        const config = nodalEndpoint.auth_config as { username?: string; password?: string } | null;
        if (config?.username && config?.password) headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
      }

      const url = `${nodalEndpoint.url.replace(/\/$/, '')}/executables/manage/${encodeURIComponent(query.name)}`;
      const response = await proxyFetch(url, { method: 'GET', headers });

      if (!response.ok) return;

      const exec = await response.json();
      const updates: Partial<Query> = {};

      if (exec.dbConnectionId) updates.nodal_db_connection_id = exec.dbConnectionId;
      if (exec.sqlQueryText) updates.sql_query_text = exec.sqlQueryText;
      if (exec.procName) updates.proc_name = exec.procName;
      if (exec.resultColumns && Array.isArray(exec.resultColumns)) {
        updates.last_known_columns = exec.resultColumns;
      }

      if (Object.keys(updates).length > 0) {
        await updateQuery(query.id, updates);
      }
    } catch {
      // Silent failure for refresh
    } finally {
      setRefreshingQueryId(null);
    }
  };

  if (!activeCompany) {
    return (
      <div className="min-h-full bg-slate-50 dark:bg-gray-900">
        <div className="px-8 pt-8 pb-0">
          <PageHeader
            icon={Database}
            title="Query Manager"
            subtitle="Create and manage your data queries"
          />
        </div>
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-500 dark:text-gray-400">Please select a company to manage queries.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-gray-900">
      <div className="px-8 pt-8 pb-0">
        <PageHeader
          icon={Database}
          title="Query Manager"
          subtitle="Create and manage your data queries"
          actions={
            <div className="flex items-center gap-2">
              <CustomDropdown
                value={purposeTypeFilter}
                onChange={(val) => setPurposeTypeFilter(val as 'all' | QueryPurposeType)}
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'query', label: 'Queries' },
                  { value: 'action', label: 'Actions' },
                  { value: 'lookup', label: 'Lookups' }
                ]}
                size="sm"
                className="w-36"
              />
              <Button variant="secondary" onClick={() => setShowFixedValues(true)}>
                <Hash className="w-4 h-4" />
                Fixed Values
              </Button>
              {nodalEndpoint && (
                <Button variant="secondary" onClick={() => setShowImportModal(true)}>
                  <Download className="w-4 h-4" />
                  Import
                </Button>
              )}
              <Dropdown
                trigger={
                  <Button>
                    <Plus className="w-4 h-4" />
                    New Query
                  </Button>
                }
                align="right"
                width="w-56"
              >
              <DropdownItem onClick={() => handleCreate('api_endpoint')}>
                <Globe className="w-4 h-4 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium">API Endpoint</div>
                  <div className="text-xs text-gray-500">Query data from REST APIs</div>
                </div>
              </DropdownItem>
              <DropdownDivider />
            <DropdownItem onClick={() => handleCreate('sql')}>
              <Database className="w-4 h-4 text-green-600" />
              <div className="flex-1">
                <div className="font-medium">SQL Query</div>
                <div className="text-xs text-gray-500">Execute SQL via NodalConnect</div>
              </div>
            </DropdownItem>
            <DropdownItem onClick={() => handleCreate('stored_procedure')}>
              <FileCode className="w-4 h-4 text-orange-600" />
              <div className="flex-1">
                <div className="font-medium">Stored Procedure</div>
                <div className="text-xs text-gray-500">Run stored procedures via NodalConnect</div>
              </div>
            </DropdownItem>
            </Dropdown>
            </div>
          }
        />
      </div>

      <div className="px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredQueries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No queries yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Create your first query to start fetching data from APIs, databases, or stored procedures.
            </p>
            <Button onClick={() => handleCreate('api_endpoint')}>
              <Plus className="w-4 h-4" />
              Create API Endpoint Query
            </Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Endpoint / Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredQueries.map((query) => {
                  const typeConfig = QUERY_TYPE_CONFIG[query.query_type];
                  const TypeIcon = typeConfig.icon;
                  const purposeBadge = query.purpose_type === 'action'
                    ? 'bg-amber-100 text-amber-800'
                    : query.purpose_type === 'lookup'
                    ? 'bg-violet-100 text-violet-800'
                    : 'bg-sky-100 text-sky-800';

                  return (
                    <tr key={query.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          {(query.query_type === 'sql' || query.query_type === 'stored_procedure') && (
                            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Active on NodalConnect" />
                          )}
                          <span className="font-medium text-gray-900 dark:text-white">{query.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${purposeBadge}`}>
                          {query.purpose_type === 'action' ? 'Action' : query.purpose_type === 'lookup' ? 'Lookup' : 'Query'}
                        </span>
                      </td>
                      <td className="px-6 py-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}>
                          <TypeIcon className="w-3 h-3" />
                          {typeConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-2 text-sm">
                          {query.query_type === 'sql' || query.query_type === 'stored_procedure' ? (
                            <span className="text-gray-500 dark:text-gray-400">
                              {query.nodal_db_connection_id || 'No DB'}
                            </span>
                          ) : (
                            <>
                              <span className="text-gray-500 dark:text-gray-400">{query.api_endpoints?.name || '-'}</span>
                              {query.api_sub_path && (
                                <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">/{query.api_sub_path}</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-2">
                        {query.query_type === 'sql' || query.query_type === 'stored_procedure' ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                            Nodal Connect
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getMethodBadgeClasses(query.http_method)}`}>
                            {query.http_method}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleTest(query as QueryWithRelations)}
                            className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                            title="Test Query"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          {(query.query_type === 'sql' || query.query_type === 'stored_procedure') && nodalEndpoint && (
                            <button
                              onClick={() => handleRefreshFromNodal(query)}
                              className="p-1 text-gray-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                              title="Refresh from NodalConnect"
                              disabled={refreshingQueryId === query.id}
                            >
                              <RefreshCw className={`w-4 h-4 ${refreshingQueryId === query.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                          <button
                            onClick={() => handleStartCopy(query)}
                            className="p-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
                            title="Copy"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {query.purpose_type === 'query' && (
                            <button
                              onClick={() => handleOpenCreateDashboard(query)}
                              className="p-1 text-gray-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                              title="Create Dashboard"
                            >
                              <LayoutDashboard className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(query)}
                            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(query.id)}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingQuery ? 'Edit Query' : 'New Query'}
        size="2xl"
      >
        <div className="flex items-center gap-2 mb-4 pb-4 border-b dark:border-gray-700">
          <span className="text-sm text-gray-500">Edit</span>
          <span className="text-sm font-medium text-orange-500">Query</span>
        </div>

        {selectedType === 'api_endpoint' && (
          <ApiEndpointQueryForm
            query={editingQuery}
            onSave={handleSave}
            onCancel={handleCloseModal}
            saving={saving}
            saveError={saveError}
            onClearError={() => setSaveError('')}
            onOpenFixedValues={() => { setShowModal(false); setShowFixedValues(true); }}
          />
        )}

        {(selectedType === 'sql' || selectedType === 'stored_procedure') && (
          <NodalConnectQueryForm
            queryType={selectedType}
            query={editingQuery}
            onSave={handleSave}
            onCancel={handleCloseModal}
            saving={saving}
            saveError={saveError}
            onClearError={() => setSaveError('')}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Query"
        size="sm"
      >
        {(() => {
          const queryToDelete = queries.find(q => q.id === showDeleteConfirm);
          const isNodal = queryToDelete && (queryToDelete.query_type === 'sql' || queryToDelete.query_type === 'stored_procedure');
          return (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Are you sure you want to delete this query? This action cannot be undone.
              </p>
              {isNodal && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    This will also remove the executable from NodalConnect.
                  </p>
                </div>
              )}
              {deleteWarning && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                  {deleteWarning}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                  loading={deletingNodalQuery}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        isOpen={!!testingQuery}
        onClose={handleCloseTest}
        title="Test Query"
        size="xl"
      >
        {testingQuery && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b dark:border-gray-700">
              {testingQuery.query_type === 'sql' || testingQuery.query_type === 'stored_procedure' ? (
                <span className={`px-2 py-1 text-xs font-medium rounded ${testingQuery.query_type === 'sql' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {testingQuery.query_type === 'sql' ? 'SQL' : 'SP'}
                </span>
              ) : (
                <span className={`px-2 py-1 text-xs font-medium rounded ${getMethodBadgeClasses(testingQuery.http_method)}`}>
                  {testingQuery.http_method}
                </span>
              )}
              <span className="text-sm font-medium text-gray-900 dark:text-white">{testingQuery.name}</span>
              {testingQuery.api_sub_path && testingQuery.query_type === 'api_endpoint' && (
                <span className="text-xs text-gray-500 font-mono">/{testingQuery.api_sub_path}</span>
              )}
            </div>

            {testLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : testResult ? (
              <div className="space-y-4">
                {testResult.url && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase mb-2">Request URL</div>
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg font-mono text-xs break-all text-gray-800 dark:text-gray-200">
                      {testResult.url}
                    </div>
                  </div>
                )}

                {testResult.body && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase mb-2">Request Body</div>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-xs overflow-auto max-h-48 font-mono text-gray-800 dark:text-gray-200">
                      {testResult.body}
                    </pre>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {testResult.error ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : testResult.status >= 200 && testResult.status < 300 ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {testResult.error ? (
                      <span className="text-red-600 dark:text-red-400">Error: {testResult.error}</span>
                    ) : (
                      <span className={testResult.status >= 200 && testResult.status < 300 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        Status: {testResult.status}
                      </span>
                    )}
                  </span>
                </div>

                {/* Results Grid */}
                {getTestResultRows().length > 0 && (
                  <div
                    ref={testGridCallbackRef}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                  />
                )}

                {/* Collapsible Response + Copy Button */}
                {testResult.data !== null && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 cursor-pointer select-none"
                      onClick={() => setTestResponseExpanded(!testResponseExpanded)}
                    >
                      <div className="flex items-center gap-2">
                        {testResponseExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="text-xs font-medium text-gray-500 uppercase">Response</span>
                      </div>
                      <button
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleCopyTestResult(); }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {testCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    {testResponseExpanded && (
                      <pre className="bg-gray-900 text-gray-100 p-4 text-xs overflow-auto max-h-96 font-mono">
                        {typeof testResult.data === 'string'
                          ? testResult.data
                          : JSON.stringify(testResult.data, null, 2)
                        }
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
              <Button variant="secondary" onClick={handleCloseTest}>
                Close
              </Button>
              <Button onClick={() => handleTest(testingQuery)}>
                <Play className="w-4 h-4" />
                Run Again
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!copyingQuery}
        onClose={handleCloseCopy}
        title="Copy Query"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enter a new name for the copied query.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Query Name
            </label>
            <input
              type="text"
              value={copyName}
              onChange={(e) => {
                setCopyName(e.target.value);
                setCopyError('');
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:bg-gray-700 dark:text-white ${
                copyError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Enter query name"
              autoFocus
            />
            {copyError && (
              <p className="mt-1 text-sm text-red-600">{copyError}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={handleCloseCopy}>
              Cancel
            </Button>
            <Button onClick={handleCopy} loading={saving}>
              <Copy className="w-4 h-4" />
              Copy Query
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showParamPrompt}
        onClose={handleCloseParamPrompt}
        title="Enter Parameter Values"
        size="md"
      >
        {pendingTestQuery && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This query requires the following parameter values to run:
            </p>
            <div className="space-y-3">
              {((pendingTestQuery.user_parameters as UserParameter[]) || []).map((param) => {
                const linkedFixedValue = param.fixedValueId
                  ? fixedValues.find(fv => fv.id === param.fixedValueId)
                  : fixedValues.find(fv => fv.id === param.dataType) || null;

                if (linkedFixedValue?.value_type === 'lookup') {
                  const lookupState = getLookupState(linkedFixedValue.id);
                  return (
                    <div key={param.name}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                          value={testParamValues[param.name] || ''}
                          onChange={(val) => setTestParamValues(prev => ({
                            ...prev,
                            [param.name]: val
                          }))}
                          options={lookupState.options}
                          placeholder={`Select ${linkedFixedValue?.name || param.name}...`}
                        />
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {linkedFixedValue ? `Fixed: ${linkedFixedValue.name}` : param.dataType} {param.target === 'path' ? '(Path parameter)' : '(Filter parameter)'}
                      </p>
                    </div>
                  );
                }

                const isListType = linkedFixedValue?.is_list;
                const listItems = isListType
                  ? ((linkedFixedValue?.list_values as { value: string; description: string }[]) || [])
                  : [];

                return (
                  <div key={param.name}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {param.prompt || param.name}
                    </label>
                    {isListType && listItems.length > 0 ? (
                      <CustomDropdown
                        value={testParamValues[param.name] || ''}
                        onChange={(val) => setTestParamValues(prev => ({
                          ...prev,
                          [param.name]: val
                        }))}
                        options={listItems.map((item) => ({
                          value: item.value,
                          label: item.description || item.value
                        }))}
                        placeholder={`Select ${linkedFixedValue?.name || param.name}...`}
                      />
                    ) : (param.dataType === 'Date' || param.dataType === 'Date (Fixed)') ? (
                      <DatePicker
                        value={testParamValues[param.name] || ''}
                        onChange={(v) => setTestParamValues(prev => ({
                          ...prev,
                          [param.name]: v
                        }))}
                        placeholder={`Select date for ${param.name}`}
                      />
                    ) : (
                      <input
                        type="text"
                        value={testParamValues[param.name] || ''}
                        onChange={(e) => setTestParamValues(prev => ({
                          ...prev,
                          [param.name]: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder={`Enter value for ${param.name}`}
                      />
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {linkedFixedValue ? `Fixed: ${linkedFixedValue.name}` : param.dataType} {param.target === 'path' ? '(Path parameter)' : '(Filter parameter)'}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
              <Button variant="secondary" onClick={handleCloseParamPrompt}>
                Cancel
              </Button>
              <Button onClick={handleParamSubmit}>
                <Play className="w-4 h-4" />
                Run Test
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <FixedValuesModal
        isOpen={showFixedValues}
        onClose={() => setShowFixedValues(false)}
      />

      {nodalEndpoint && (
        <ImportNodalModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          nodalEndpoint={nodalEndpoint}
          nodalDatabases={nodalDatabases}
          existingQueryNames={queries.map(q => q.name)}
          onImport={handleImportExecutables}
        />
      )}

      <Modal
        isOpen={showCreateDashboard}
        onClose={handleCloseCreateDashboard}
        title="Create Dashboard from Query"
        size="md"
      >
        {dashboardCreatedId ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-300">
                Dashboard created successfully.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={handleCloseCreateDashboard}>
                Close
              </Button>
              <Button onClick={() => {
                handleCloseCreateDashboard();
                window.location.href = `/dashboard/${dashboardCreatedId}`;
              }}>
                <LayoutDashboard className="w-4 h-4" />
                Open Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create a new dashboard with a single cell linked to this query.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dashboard Name
              </label>
              <input
                type="text"
                value={createDashboardName}
                onChange={(e) => {
                  setCreateDashboardName(e.target.value);
                  setCreateDashboardError('');
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:bg-gray-700 dark:text-white"
                placeholder="Enter dashboard name"
                autoFocus
              />
            </div>

            {!showNewFolderInline ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Folder
                </label>
                {dashboardFolders.length > 0 ? (
                  <CustomDropdown
                    value={createDashboardFolderId}
                    onChange={(val) => setCreateDashboardFolderId(val)}
                    options={dashboardFolders.map(f => ({ value: f.id, label: f.name }))}
                    placeholder="Select a folder..."
                  />
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No folders exist yet. Create one below.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewFolderInline(true)}
                  className="mt-2 flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  Create new folder
                </button>
              </div>
            ) : (
              <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Folder</span>
                  <button
                    type="button"
                    onClick={() => setShowNewFolderInline(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Use existing
                  </button>
                </div>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:bg-gray-700 dark:text-white"
                  placeholder="Folder name"
                />
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Color
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {FOLDER_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewFolderColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          newFolderColor === color
                            ? 'border-gray-900 dark:border-white scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {createDashboardError && (
              <p className="text-sm text-red-600 dark:text-red-400">{createDashboardError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={handleCloseCreateDashboard}>
                Cancel
              </Button>
              <Button onClick={handleCreateDashboardSubmit} loading={creatingDashboard}>
                <LayoutDashboard className="w-4 h-4" />
                Create Dashboard
              </Button>
            </div>
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
}
