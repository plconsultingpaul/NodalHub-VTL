import { useState } from 'react';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useAuth } from '../../contexts/AuthContext';
import { proxyFetch } from '../../lib/apiProxy';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import Modal from '../../components/ui/Modal';
import Dropdown, { DropdownItem, DropdownDivider } from '../../components/ui/Dropdown';
import { Plus, MoreHorizontal, Pencil, Trash2, Server, Activity, Play, CheckCircle, XCircle, Loader2, Database } from 'lucide-react';
import type { ApiEndpoint, NodalDatabase, EndpointType } from '../../types/database';

type AuthType = 'none' | 'api_key' | 'bearer' | 'basic';

interface EndpointFormData {
  name: string;
  url: string;
  health_endpoint: string;
  endpoint_type: EndpointType;
  auth_type: AuthType;
  auth_config: Record<string, string>;
}

const defaultFormData: EndpointFormData = {
  name: '',
  url: '',
  health_endpoint: '',
  endpoint_type: 'standard',
  auth_type: 'none',
  auth_config: {}
};

interface TestResult {
  endpointId: string;
  status: 'testing' | 'success' | 'error';
  message?: string;
}

interface DbFormData {
  name: string;
  connection_id: string;
}

export default function ApiEndpoints() {
  const { endpoints, nodalDatabases, loading, createEndpoint, updateEndpoint, deleteEndpoint, createNodalDatabase, updateNodalDatabase, deleteNodalDatabase } = useEndpoints();
  const { activeCompany } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EndpointFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string } | null>(null);

  const [showDbModal, setShowDbModal] = useState(false);
  const [editingDbId, setEditingDbId] = useState<string | null>(null);
  const [dbFormData, setDbFormData] = useState<DbFormData>({ name: '', connection_id: '' });
  const [dbSaving, setDbSaving] = useState(false);
  const [dbError, setDbError] = useState('');
  const [deleteDbConfirmation, setDeleteDbConfirmation] = useState<{ id: string; name: string } | null>(null);
  const [managingEndpointId, setManagingEndpointId] = useState<string | null>(null);

  const canEdit = activeCompany?.role === 'Admin';

  const nodalConnectEndpoint = endpoints.find(e => e.endpoint_type === 'nodal_connect');

  const openCreateModal = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (endpoint: ApiEndpoint) => {
    setFormData({
      name: endpoint.name,
      url: endpoint.url,
      health_endpoint: endpoint.health_endpoint || '',
      endpoint_type: endpoint.endpoint_type,
      auth_type: endpoint.auth_type,
      auth_config: (endpoint.auth_config as Record<string, string>) || {}
    });
    setEditingId(endpoint.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      setError('Name and API URL are required');
      return;
    }

    if (formData.endpoint_type === 'nodal_connect' && nodalConnectEndpoint && nodalConnectEndpoint.id !== editingId) {
      setError('Only one Nodal Connect endpoint is allowed per company. Please edit the existing one instead.');
      return;
    }

    setSaving(true);
    setError('');

    const endpointData = {
      name: formData.name,
      url: formData.url,
      health_endpoint: formData.health_endpoint || null,
      endpoint_type: formData.endpoint_type,
      auth_type: formData.auth_type,
      auth_config: formData.auth_config
    };

    let result;
    if (editingId) {
      result = await updateEndpoint(editingId, endpointData);
    } else {
      result = await createEndpoint(endpointData);
    }

    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setShowModal(false);
      setFormData(defaultFormData);
      setEditingId(null);
    }
  };

  const handleDelete = (endpoint: ApiEndpoint) => {
    setDeleteConfirmation({ id: endpoint.id, name: endpoint.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    await deleteEndpoint(deleteConfirmation.id);
    setDeleteConfirmation(null);
  };

  const handleTest = async (endpoint: ApiEndpoint) => {
    setTestResults(prev => ({
      ...prev,
      [endpoint.id]: { endpointId: endpoint.id, status: 'testing' }
    }));

    try {
      const testUrl = endpoint.health_endpoint
        ? `${endpoint.url.replace(/\/$/, '')}${endpoint.health_endpoint.startsWith('/') ? '' : '/'}${endpoint.health_endpoint}`
        : endpoint.url;

      const headers: Record<string, string> = {};

      if (endpoint.auth_type === 'bearer' && endpoint.auth_config) {
        const config = endpoint.auth_config as Record<string, string>;
        if (config.token) {
          headers['Authorization'] = `Bearer ${config.token}`;
        }
      } else if (endpoint.auth_type === 'api_key' && endpoint.auth_config) {
        const config = endpoint.auth_config as Record<string, string>;
        if (config.header_name && config.api_key) {
          headers[config.header_name] = config.api_key;
        }
      } else if (endpoint.auth_type === 'basic' && endpoint.auth_config) {
        const config = endpoint.auth_config as Record<string, string>;
        if (config.username && config.password) {
          headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
        }
      }

      const response = await proxyFetch(testUrl, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        setTestResults(prev => ({
          ...prev,
          [endpoint.id]: { endpointId: endpoint.id, status: 'success', message: `Status: ${response.status}` }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          [endpoint.id]: { endpointId: endpoint.id, status: 'error', message: `HTTP ${response.status}` }
        }));
      }
    } catch {
      setTestResults(prev => ({
        ...prev,
        [endpoint.id]: { endpointId: endpoint.id, status: 'error', message: 'Connection failed' }
      }));
    }

    setTimeout(() => {
      setTestResults(prev => {
        const newResults = { ...prev };
        delete newResults[endpoint.id];
        return newResults;
      });
    }, 5000);
  };

  const getAuthLabel = (authType: AuthType | string) => {
    switch (authType) {
      case 'bearer': return 'Bearer Token';
      case 'api_key': return 'API Key';
      case 'basic': return 'Basic Auth';
      default: return 'None';
    }
  };

  const openManageDatabases = (endpointId: string) => {
    setManagingEndpointId(endpointId);
  };

  const openCreateDbModal = () => {
    setDbFormData({ name: '', connection_id: '' });
    setEditingDbId(null);
    setDbError('');
    setShowDbModal(true);
  };

  const openEditDbModal = (db: NodalDatabase) => {
    setDbFormData({ name: db.name, connection_id: db.connection_id });
    setEditingDbId(db.id);
    setDbError('');
    setShowDbModal(true);
  };

  const handleSaveDb = async () => {
    if (!dbFormData.name.trim() || !dbFormData.connection_id.trim()) {
      setDbError('Display name and Connection ID are required');
      return;
    }

    if (!managingEndpointId) return;

    setDbSaving(true);
    setDbError('');

    let result;
    if (editingDbId) {
      result = await updateNodalDatabase(editingDbId, {
        name: dbFormData.name,
        connection_id: dbFormData.connection_id
      });
    } else {
      result = await createNodalDatabase({
        name: dbFormData.name,
        connection_id: dbFormData.connection_id,
        api_endpoint_id: managingEndpointId
      });
    }

    setDbSaving(false);

    if (result.error) {
      setDbError(result.error);
    } else {
      setShowDbModal(false);
      setDbFormData({ name: '', connection_id: '' });
      setEditingDbId(null);
    }
  };

  const handleDeleteDb = (db: NodalDatabase) => {
    setDeleteDbConfirmation({ id: db.id, name: db.name });
  };

  const handleConfirmDeleteDb = async () => {
    if (!deleteDbConfirmation) return;
    await deleteNodalDatabase(deleteDbConfirmation.id);
    setDeleteDbConfirmation(null);
  };

  const renderTestStatus = (endpoint: ApiEndpoint) => {
    const result = testResults[endpoint.id];
    if (!result) return null;

    if (result.status === 'testing') {
      return (
        <span className="flex items-center gap-1.5 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Testing...
        </span>
      );
    }

    if (result.status === 'success') {
      return (
        <span className="flex items-center gap-1.5 text-green-600 text-sm">
          <CheckCircle className="w-4 h-4" />
          {result.message}
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 text-red-600 text-sm">
        <XCircle className="w-4 h-4" />
        {result.message}
      </span>
    );
  };

  const endpointDatabases = nodalDatabases.filter(db => db.api_endpoint_id === managingEndpointId);

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">API Endpoints</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure and test your API connections
            </p>
          </div>
          {canEdit && (
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              Add API
            </Button>
          )}
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : endpoints.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Server className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No API endpoints configured</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              Add an API endpoint to start connecting your dashboards to external data.
            </p>
            {canEdit && (
              <Button onClick={openCreateModal}>
                <Plus className="w-4 h-4" />
                Add Your First API
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {endpoints.map((endpoint) => (
              <div key={endpoint.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    endpoint.endpoint_type === 'nodal_connect'
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {endpoint.endpoint_type === 'nodal_connect' ? (
                      <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Server className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white">{endpoint.name}</p>
                      {endpoint.endpoint_type === 'nodal_connect' && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          Nodal Connect
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-2xl">{endpoint.url}</span>
                      {endpoint.auth_type !== 'none' && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {getAuthLabel(endpoint.auth_type)}
                        </span>
                      )}
                    </div>
                    {endpoint.health_endpoint && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Activity className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Health: {endpoint.health_endpoint}</span>
                      </div>
                    )}
                    {endpoint.endpoint_type === 'nodal_connect' && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Database className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {nodalDatabases.filter(db => db.api_endpoint_id === endpoint.id).length} database connection(s)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {renderTestStatus(endpoint)}
                  {endpoint.endpoint_type === 'nodal_connect' && canEdit && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openManageDatabases(endpoint.id)}
                    >
                      <Database className="w-4 h-4" />
                      Databases
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTest(endpoint)}
                    disabled={testResults[endpoint.id]?.status === 'testing'}
                  >
                    <Play className="w-4 h-4" />
                    Test
                  </Button>
                  {canEdit && (
                    <Dropdown
                      trigger={
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      }
                      align="right"
                      width="w-40"
                    >
                      <DropdownItem onClick={() => openEditModal(endpoint)}>
                        <Pencil className="w-4 h-4" />
                        Edit
                      </DropdownItem>
                      <DropdownDivider />
                      <DropdownItem onClick={() => handleDelete(endpoint)} danger>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </DropdownItem>
                    </Dropdown>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Endpoint Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit API Endpoint' : 'Add API Endpoint'}
        size="lg"
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="Production API"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint Type</label>
            <CustomDropdown
              value={formData.endpoint_type}
              onChange={(val) => setFormData({ ...formData, endpoint_type: val as EndpointType })}
              options={[
                { value: 'standard', label: 'Standard REST API' },
                { value: 'nodal_connect', label: 'Nodal Connect' },
              ]}
            />
            {formData.endpoint_type === 'nodal_connect' && (
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                Nodal Connect endpoints support SQL Query and Stored Procedure execution.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder={formData.endpoint_type === 'nodal_connect' ? 'https://your-nodal-connect-server.com' : 'https://api.example.com'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Authentication Type</label>
            <CustomDropdown
              value={formData.auth_type}
              onChange={(val) => setFormData({ ...formData, auth_type: val as AuthType, auth_config: {} })}
              options={[
                { value: 'none', label: 'No Authentication' },
                { value: 'bearer', label: 'Bearer Token' },
                { value: 'api_key', label: 'API Key' },
                { value: 'basic', label: 'Basic Auth' },
              ]}
            />
          </div>

          {formData.auth_type === 'bearer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bearer Token</label>
              <input
                type="password"
                value={formData.auth_config.token || ''}
                onChange={(e) => setFormData({ ...formData, auth_config: { token: e.target.value } })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Enter your bearer token"
              />
            </div>
          )}

          {formData.auth_type === 'api_key' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Header Name</label>
                <input
                  type="text"
                  value={formData.auth_config.header_name || ''}
                  onChange={(e) => setFormData({ ...formData, auth_config: { ...formData.auth_config, header_name: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="X-API-Key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={formData.auth_config.api_key || ''}
                  onChange={(e) => setFormData({ ...formData, auth_config: { ...formData.auth_config, api_key: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Your API key"
                />
              </div>
            </div>
          )}

          {formData.auth_type === 'basic' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.auth_config.username || ''}
                  onChange={(e) => setFormData({ ...formData, auth_config: { ...formData.auth_config, username: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.auth_config.password || ''}
                  onChange={(e) => setFormData({ ...formData, auth_config: { ...formData.auth_config, password: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Password"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Health Endpoint</label>
            <input
              type="text"
              value={formData.health_endpoint}
              onChange={(e) => setFormData({ ...formData, health_endpoint: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="/health or /api/status"
            />
            <p className="mt-1 text-xs text-gray-500">Optional endpoint path for health checks and testing</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingId ? 'Save Changes' : 'Add API'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Endpoint Confirmation */}
      <Modal
        isOpen={!!deleteConfirmation}
        onClose={() => setDeleteConfirmation(null)}
        title="Confirm Deletion"
        size="md"
      >
        {deleteConfirmation && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Delete API Endpoint?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  You're about to permanently delete <span className="font-semibold text-gray-900 dark:text-white">{deleteConfirmation.name}</span>.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This will remove the endpoint configuration and any associated data. Dashboards using this endpoint may stop working.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="secondary" onClick={() => setDeleteConfirmation(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete}>
                <Trash2 className="w-4 h-4" />
                Delete Endpoint
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Manage Database Connections Modal */}
      <Modal
        isOpen={!!managingEndpointId}
        onClose={() => setManagingEndpointId(null)}
        title="Database Connections"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure database connections for this Nodal Connect endpoint. These connections are used when creating SQL or Stored Procedure queries.
          </p>

          {endpointDatabases.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              <Database className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No database connections configured</p>
              <Button size="sm" onClick={openCreateDbModal}>
                <Plus className="w-4 h-4" />
                Add Connection
              </Button>
            </div>
          ) : (
            <>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                      <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Display Name</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Connection ID</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {endpointDatabases.map((db) => (
                      <tr key={db.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{db.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">{db.connection_id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditDbModal(db)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDb(db)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center pt-2">
                <Button size="sm" onClick={openCreateDbModal}>
                  <Plus className="w-4 h-4" />
                  Add Connection
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setManagingEndpointId(null)}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Create/Edit Database Connection Modal */}
      <Modal
        isOpen={showDbModal}
        onClose={() => setShowDbModal(false)}
        title={editingDbId ? 'Edit Database Connection' : 'Add Database Connection'}
        size="md"
      >
        <div className="space-y-4">
          {dbError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {dbError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
            <input
              type="text"
              value={dbFormData.name}
              onChange={(e) => setDbFormData({ ...dbFormData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="e.g. TMW Development"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">A friendly name for this database connection</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Connection ID</label>
            <input
              type="text"
              value={dbFormData.connection_id}
              onChange={(e) => setDbFormData({ ...dbFormData, connection_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent font-mono dark:bg-gray-700 dark:text-white"
              placeholder="e.g. TMWDEV"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">The connection identifier configured in NodalConnect</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setShowDbModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDb} loading={dbSaving}>
              {editingDbId ? 'Save Changes' : 'Add Connection'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Database Connection Confirmation */}
      <Modal
        isOpen={!!deleteDbConfirmation}
        onClose={() => setDeleteDbConfirmation(null)}
        title="Delete Database Connection"
        size="md"
      >
        {deleteDbConfirmation && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">{deleteDbConfirmation.name}</span>? Queries using this connection may stop working.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="secondary" onClick={() => setDeleteDbConfirmation(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDeleteDb}>
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
