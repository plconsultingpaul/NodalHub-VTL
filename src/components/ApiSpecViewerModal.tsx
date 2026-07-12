import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Button from './ui/Button';
import { X, Search, Download } from 'lucide-react';
import type { ApiSpecWithEndpoint, ApiSpecEndpoint, ApiEndpointField } from '../types/database';

interface ApiSpecViewerModalProps {
  spec: ApiSpecWithEndpoint;
  onClose: () => void;
  onDownload: (spec: ApiSpecWithEndpoint) => void;
}

export default function ApiSpecViewerModal({ spec, onClose, onDownload }: ApiSpecViewerModalProps) {
  const [endpoints, setEndpoints] = useState<ApiSpecEndpoint[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [fields, setFields] = useState<ApiEndpointField[]>([]);
  const [endpointSearchQuery, setEndpointSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  const [fieldTypeFilter, setFieldTypeFilter] = useState('ALL');
  const [loadingEndpoints, setLoadingEndpoints] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);

  useEffect(() => {
    const fetchEndpoints = async () => {
      setLoadingEndpoints(true);
      const { data, error } = await supabase
        .from('api_spec_endpoints')
        .select('*')
        .eq('api_spec_id', spec.id)
        .order('path');

      if (!error && data) {
        setEndpoints(data);
      }
      setLoadingEndpoints(false);
    };

    fetchEndpoints();
  }, [spec.id]);

  const handleSelectEndpoint = async (endpoint: ApiSpecEndpoint) => {
    setSelectedEndpointId(endpoint.id);
    setLoadingFields(true);
    setFields([]);
    setFieldSearchQuery('');
    setFieldTypeFilter('ALL');

    const { data, error } = await supabase
      .from('api_endpoint_fields')
      .select('*')
      .eq('api_spec_endpoint_id', endpoint.id)
      .order('field_path');

    if (!error && data) {
      setFields(data);
    }
    setLoadingFields(false);
  };

  const filteredEndpoints = endpoints.filter((endpoint) => {
    const matchesMethod = methodFilter === 'ALL' || endpoint.method === methodFilter;
    const matchesSearch = !endpointSearchQuery ||
      endpoint.path.toLowerCase().includes(endpointSearchQuery.toLowerCase()) ||
      endpoint.summary?.toLowerCase().includes(endpointSearchQuery.toLowerCase());
    return matchesMethod && matchesSearch;
  });

  const filteredFields = fields.filter((field) => {
    const matchesSearch = !fieldSearchQuery ||
      field.field_path.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
      field.description?.toLowerCase().includes(fieldSearchQuery.toLowerCase());

    const matchesType = fieldTypeFilter === 'ALL' ||
      (fieldTypeFilter === 'PARAMS' && (
        field.field_path.startsWith('[query]') ||
        field.field_path.startsWith('[path]') ||
        field.field_path.startsWith('[header]')
      )) ||
      (fieldTypeFilter === 'BODY' && field.field_path.startsWith('[body]')) ||
      (fieldTypeFilter === 'RESPONSE' && field.field_path.startsWith('[response]'));

    return matchesSearch && matchesType;
  });

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

  const getFieldTypeBadgeClasses = (fieldType: string) => {
    switch (fieldType) {
      case 'string': return 'bg-blue-100 text-blue-700';
      case 'number':
      case 'integer': return 'bg-green-100 text-green-700';
      case 'boolean': return 'bg-teal-100 text-teal-700';
      case 'array': return 'bg-orange-100 text-orange-700';
      case 'object': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-[90vw] h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {spec.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Version {spec.version}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-6 p-6 min-h-0">
          <div className="flex flex-col min-h-0">
            <div className="flex-shrink-0 mb-3 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Available Endpoints</h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search endpoints..."
                  value={endpointSearchQuery}
                  onChange={(e) => setEndpointSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => (
                  <button
                    key={method}
                    onClick={() => setMethodFilter(method)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      methodFilter === method
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingEndpoints ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gray-900 dark:border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredEndpoints.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
                  No endpoints found
                </div>
              ) : (
                filteredEndpoints.map((endpoint) => (
                  <button
                    key={endpoint.id}
                    onClick={() => handleSelectEndpoint(endpoint)}
                    className={`w-full text-left rounded-lg p-3 transition-colors ${
                      selectedEndpointId === endpoint.id
                        ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${getMethodBadgeClasses(endpoint.method)}`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm text-gray-700 dark:text-gray-300 font-mono truncate">{endpoint.path}</code>
                    </div>
                    {endpoint.summary && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 ml-14 truncate">{endpoint.summary}</p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col min-h-0">
            <div className="flex-shrink-0 mb-3 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Fields {fields.length > 0 && `(${filteredFields.length})`}
              </h4>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={fieldSearchQuery}
                  onChange={(e) => setFieldSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['ALL', 'PARAMS', 'BODY', 'RESPONSE'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFieldTypeFilter(type)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      fieldTypeFilter === type
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {!selectedEndpointId ? (
                <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Click an endpoint to view its fields</p>
                </div>
              ) : loadingFields ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gray-900 dark:border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredFields.length === 0 ? (
                <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {fields.length === 0 ? 'No fields for this endpoint' : 'No fields match your filter'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFields.map((field) => (
                    <div key={field.id} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <code className="text-sm font-mono text-gray-800 dark:text-gray-200 font-medium break-all">
                          {field.field_path}
                        </code>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getFieldTypeBadgeClasses(field.field_type)}`}>
                            {field.field_type}
                          </span>
                          {field.is_required && (
                            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                              required
                            </span>
                          )}
                        </div>
                      </div>
                      {field.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{field.description}</p>
                      )}
                      {field.format && (
                        <p className="text-xs text-gray-500 dark:text-gray-500">Format: {field.format}</p>
                      )}
                      {field.example && (
                        <p className="text-xs text-gray-500 dark:text-gray-500">Example: {field.example}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <Button variant="secondary" onClick={() => onDownload(spec)}>
            <Download className="w-4 h-4" />
            Download
          </Button>
          <Button onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
