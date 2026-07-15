import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Download, Database, FileCode, CheckCircle } from 'lucide-react';
import { proxyFetch } from '../../lib/apiProxy';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type { ApiEndpoint, NodalDatabase, Query, QueryType, UserParameter } from '../../types/database';

interface ImportNodalModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodalEndpoint: ApiEndpoint;
  nodalDatabases: NodalDatabase[];
  existingQueryNames: string[];
  onImport: (queries: Partial<Query>[]) => Promise<void>;
}

interface NodalExecutable {
  name: string;
  executableType: string;
  dbConnectionId: string;
  description?: string;
  active?: boolean | string;
  sqlQueryText?: string;
  procName?: string;
  paramDefinition?: string;
  resultColumns?: string | string[];
}

function getEndpointAuthHeaders(endpoint: ApiEndpoint): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(endpoint.headers as Record<string, string> || {})
  };

  if (endpoint.auth_type === 'bearer') {
    const config = endpoint.auth_config as { token?: string } | null;
    if (config?.token) headers['Authorization'] = `Bearer ${config.token}`;
  } else if (endpoint.auth_type === 'api_key') {
    const config = endpoint.auth_config as { header_name?: string; api_key?: string } | null;
    if (config?.header_name && config?.api_key) headers[config.header_name] = config.api_key;
  } else if (endpoint.auth_type === 'basic') {
    const config = endpoint.auth_config as { username?: string; password?: string } | null;
    if (config?.username && config?.password) headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
  }

  return headers;
}

function parseParamDefinition(paramDef: string | undefined): UserParameter[] {
  if (!paramDef) return [];

  try {
    const parsed = JSON.parse(paramDef);
    if (Array.isArray(parsed)) {
      return parsed.map((p: { name: string; type?: string; dataType?: string }) => ({
        name: `@${p.name.replace(/^@/, '')}`,
        prompt: p.name.replace(/^@/, ''),
        dataType: 'Text' as const,
      }));
    }
  } catch {
    const names = paramDef.split(/[,\n;]/).map(s => s.trim()).filter(Boolean);
    return names.map(n => ({
      name: `@${n.replace(/^@/, '')}`,
      prompt: n.replace(/^@/, ''),
      dataType: 'Text' as const,
    }));
  }

  return [];
}

export default function ImportNodalModal({
  isOpen,
  onClose,
  nodalEndpoint,
  nodalDatabases,
  existingQueryNames,
  onImport
}: ImportNodalModalProps) {
  const [executables, setExecutables] = useState<NodalExecutable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [showDbPicker, setShowDbPicker] = useState(false);
  const [selectedDbConnectionId, setSelectedDbConnectionId] = useState('');

  const availableDatabases = useMemo(
    () => nodalDatabases.filter(db => db.api_endpoint_id === nodalEndpoint.id),
    [nodalDatabases, nodalEndpoint.id]
  );

  useEffect(() => {
    if (isOpen) {
      fetchExecutables();
      setSelected(new Set());
      setSearchTerm('');
      setImportSuccess(false);
      setShowDbPicker(false);
      setSelectedDbConnectionId('');
    }
  }, [isOpen]);

  const fetchExecutables = async () => {
    setLoading(true);
    setError('');

    try {
      const headers = getEndpointAuthHeaders(nodalEndpoint);
      const url = `${nodalEndpoint.url.replace(/\/$/, '')}/executables/manage?size=200`;

      const response = await proxyFetch(url, { method: 'GET', headers });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      let items: NodalExecutable[];
      if (Array.isArray(data)) {
        items = data;
      } else if (data?._embedded?.executableDefinitionList) {
        items = data._embedded.executableDefinitionList;
      } else {
        items = data?.content || data?.items || data?.executables || [];
      }

      setExecutables(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch executables');
    } finally {
      setLoading(false);
    }
  };

  const existingNamesLower = useMemo(
    () => new Set(existingQueryNames.map(n => n.toLowerCase())),
    [existingQueryNames]
  );

  const filteredExecutables = useMemo(() => {
    return executables
      .filter(e => !existingNamesLower.has(e.name.toLowerCase()))
      .filter(e => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return e.name.toLowerCase().includes(term) ||
          e.description?.toLowerCase().includes(term) ||
          e.dbConnectionId?.toLowerCase().includes(term);
      });
  }, [executables, existingNamesLower, searchTerm]);

  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredExecutables.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredExecutables.map(e => e.name)));
    }
  };

  const selectedNeedDb = useMemo(() => {
    return [...selected].some(name => {
      const exec = executables.find(e => e.name === name);
      return exec && !exec.dbConnectionId;
    });
  }, [selected, executables]);

  const handleImportClick = () => {
    if (selected.size === 0) return;

    if (selectedNeedDb && availableDatabases.length > 1) {
      setShowDbPicker(true);
      return;
    }

    doImport();
  };

  const doImport = async () => {
    setImporting(true);
    setError('');

    try {
      const queriesToImport: Partial<Query>[] = [];
      const defaultDbConnectionId = availableDatabases.length === 1
        ? availableDatabases[0].connection_id
        : selectedDbConnectionId || null;

      for (const name of selected) {
        const exec = executables.find(e => e.name === name);
        if (!exec) continue;

        const queryType: QueryType = exec.executableType === 'STORED_PROCEDURE' ? 'stored_procedure' : 'sql';
        const userParams = parseParamDefinition(exec.paramDefinition);

        let columns: string[] | null = null;
        if (exec.resultColumns) {
          if (Array.isArray(exec.resultColumns)) {
            columns = exec.resultColumns;
          } else if (typeof exec.resultColumns === 'string') {
            columns = exec.resultColumns.split(',').map(c => c.trim()).filter(Boolean);
          }
        }

        const dbConnectionId = exec.dbConnectionId || defaultDbConnectionId;

        queriesToImport.push({
          name: exec.name,
          query_type: queryType,
          purpose_type: 'query',
          nodal_db_connection_id: dbConnectionId,
          sql_query_text: exec.sqlQueryText || null,
          proc_name: exec.procName || null,
          user_parameters: userParams as unknown as Query['user_parameters'],
          last_known_columns: columns,
          api_endpoint_id: nodalEndpoint.id,
          http_method: 'POST',
          api_sub_path: 'executables/run',
        });
      }

      await onImport(queriesToImport);
      setImportSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const getTypeLabel = (execType: string) => {
    return execType === 'STORED_PROCEDURE' ? 'SP' : 'SQL';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from NodalConnect" size="2xl">
      <div className="space-y-4">
        {importSuccess ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {selected.size} executable{selected.size !== 1 ? 's' : ''} imported successfully
            </p>
          </div>
        ) : showDbPicker ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Some selected executables have no database assigned. Please select the database connection to use for these imports.
            </p>

            <CustomDropdown
              label="Database Connection"
              value={selectedDbConnectionId}
              onChange={setSelectedDbConnectionId}
              options={availableDatabases.map(db => ({
                value: db.connection_id,
                label: `${db.name} (${db.connection_id})`
              }))}
              placeholder="Select a database..."
            />

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Button variant="secondary" onClick={() => setShowDbPicker(false)}>
                Back
              </Button>
              <Button
                onClick={doImport}
                loading={importing}
                disabled={!selectedDbConnectionId}
              >
                <Download className="w-4 h-4" />
                Import Selected ({selected.size})
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select executables from your NodalConnect server to import as local queries. Already-imported executables are hidden.
            </p>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                placeholder="Search executables..."
              />
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : filteredExecutables.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                {executables.length === 0
                  ? 'No executables found on the server.'
                  : 'All executables have already been imported.'}
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selected.size === filteredExecutables.length && filteredExecutables.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Type</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Database</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredExecutables.map((exec) => (
                      <tr
                        key={exec.name}
                        className={`cursor-pointer transition-colors ${
                          selected.has(exec.name)
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}
                        onClick={() => toggleSelect(exec.name)}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(exec.name)}
                            onChange={() => toggleSelect(exec.name)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">
                          {exec.name}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                            exec.executableType === 'STORED_PROCEDURE'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          }`}>
                            {exec.executableType === 'STORED_PROCEDURE' ? (
                              <FileCode className="w-3 h-3" />
                            ) : (
                              <Database className="w-3 h-3" />
                            )}
                            {getTypeLabel(exec.executableType)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 font-mono text-xs">
                          {nodalDatabases.find(db => db.connection_id === exec.dbConnectionId)?.name || exec.dbConnectionId || '-'}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                          {exec.description || '-'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            exec.active !== false ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selected.size} of {filteredExecutables.length} selected
              </span>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImportClick}
                  loading={importing}
                  disabled={selected.size === 0}
                >
                  <Download className="w-4 h-4" />
                  Import Selected ({selected.size})
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
