import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import CustomDropdown from '../ui/CustomDropdown';
import { useEndpoints } from '../../hooks/useEndpoints';
import { PlayCircle, CheckCircle, XCircle, Plus, Trash2, GripVertical } from 'lucide-react';
import type { DashboardWidget, Json } from '../../types/database';

interface ColumnConfig {
  field: string;
  title: string;
  width?: number;
  formatter?: string;
}

interface GridOptions {
  pagination: boolean;
  pageSize: number;
  sortable: boolean;
}

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (widget: Partial<DashboardWidget>) => Promise<void>;
  editingWidget?: DashboardWidget | null;
}

export default function AddWidgetModal({ isOpen, onClose, onSave, editingWidget }: AddWidgetModalProps) {
  const { endpoints, testEndpoint } = useEndpoints();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [gridOptions, setGridOptions] = useState<GridOptions>({
    pagination: true,
    pageSize: 10,
    sortable: true
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; fields: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingWidget) {
      setTitle(editingWidget.title);
      setSelectedEndpointId(editingWidget.endpoint_id || '');
      setColumns((editingWidget.column_config as ColumnConfig[]) || []);
      setGridOptions((editingWidget.grid_options as GridOptions) || { pagination: true, pageSize: 10, sortable: true });
      setStep(1);
    } else {
      resetForm();
    }
  }, [editingWidget, isOpen]);

  const resetForm = () => {
    setTitle('');
    setSelectedEndpointId('');
    setColumns([]);
    setGridOptions({ pagination: true, pageSize: 10, sortable: true });
    setStep(1);
    setTestResult(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTestEndpoint = async () => {
    const endpoint = endpoints.find(e => e.id === selectedEndpointId);
    if (!endpoint) return;

    setTesting(true);
    setTestResult(null);

    const result = await testEndpoint(endpoint);

    if (result.error) {
      setTestResult({ success: false, fields: [] });
    } else {
      let fields: string[] = [];
      const data = result.data;

      if (Array.isArray(data) && data.length > 0) {
        fields = Object.keys(data[0]);
      } else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (obj.data && Array.isArray(obj.data) && obj.data.length > 0) {
          fields = Object.keys(obj.data[0]);
        } else if (obj.results && Array.isArray(obj.results) && obj.results.length > 0) {
          fields = Object.keys(obj.results[0]);
        } else if (obj.items && Array.isArray(obj.items) && obj.items.length > 0) {
          fields = Object.keys(obj.items[0]);
        } else {
          fields = Object.keys(obj);
        }
      }

      setTestResult({ success: true, fields });

      if (columns.length === 0 && fields.length > 0) {
        setColumns(fields.slice(0, 5).map(field => ({
          field,
          title: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        })));
      }
    }

    setTesting(false);
  };

  const handleAddColumn = () => {
    setColumns([...columns, { field: '', title: '' }]);
  };

  const handleRemoveColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, key: keyof ColumnConfig, value: string | number) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [key]: value };
    setColumns(newColumns);
  };

  const handleSave = async () => {
    setSaving(true);

    await onSave({
      title: title || 'New Widget',
      endpoint_id: selectedEndpointId || null,
      column_config: columns as unknown as Json,
      grid_options: gridOptions as unknown as Json
    });

    setSaving(false);
    handleClose();
  };

  const selectedEndpoint = endpoints.find(e => e.id === selectedEndpointId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingWidget ? 'Edit Widget' : 'Add Widget'}
      size="lg"
    >
      <div className="space-y-6">
        <div className="flex gap-4 border-b border-gray-200 pb-4">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                step === s ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                {s}
              </span>
              {s === 1 ? 'Basic Info' : s === 2 ? 'Columns' : 'Options'}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Widget Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="My Data Grid"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Endpoint</label>
              <CustomDropdown
                value={selectedEndpointId}
                onChange={(val) => {
                  setSelectedEndpointId(val);
                  setTestResult(null);
                }}
                options={endpoints.map((endpoint) => ({
                  value: endpoint.id,
                  label: `${endpoint.name} (${endpoint.method} ${endpoint.url})`
                }))}
                placeholder="Select an endpoint..."
                autoWidth
              />
              {endpoints.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No endpoints configured. Go to Settings &gt; API Endpoints to add one.
                </p>
              )}
            </div>

            {selectedEndpointId && (
              <div className="flex items-center gap-4">
                <Button variant="secondary" onClick={handleTestEndpoint} loading={testing}>
                  <PlayCircle className="w-4 h-4" />
                  Test & Detect Fields
                </Button>
                {testResult && (
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-green-600">
                          Found {testResult.fields.length} fields
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-500" />
                        <span className="text-sm text-red-600">Connection failed</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Column Configuration</h4>
                <p className="text-sm text-gray-500">Define which fields to display and how</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleAddColumn}>
                <Plus className="w-4 h-4" />
                Add Column
              </Button>
            </div>

            {columns.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500 mb-4">No columns configured. Auto-detect fields or add manually.</p>
                <Button variant="secondary" onClick={handleAddColumn}>
                  <Plus className="w-4 h-4" />
                  Add Column
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {columns.map((col, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Field Name</label>
                        <input
                          type="text"
                          value={col.field}
                          onChange={(e) => handleColumnChange(index, 'field', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                          placeholder="field_name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Display Title</label>
                        <input
                          type="text"
                          value={col.title}
                          onChange={(e) => handleColumnChange(index, 'title', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                          placeholder="Column Title"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Width (px)</label>
                        <input
                          type="number"
                          value={col.width || ''}
                          onChange={(e) => handleColumnChange(index, 'width', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                          placeholder="Auto"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveColumn(index)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {testResult?.fields && testResult.fields.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Available fields from API:</p>
                <div className="flex flex-wrap gap-2">
                  {testResult.fields.map((field) => (
                    <button
                      key={field}
                      onClick={() => {
                        if (!columns.find(c => c.field === field)) {
                          setColumns([...columns, {
                            field,
                            title: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                          }]);
                        }
                      }}
                      className={`px-2 py-1 text-xs rounded-md ${
                        columns.find(c => c.field === field)
                          ? 'bg-gray-200 text-gray-500'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      disabled={!!columns.find(c => c.field === field)}
                    >
                      {field}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Grid Options</h4>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gridOptions.pagination}
                  onChange={(e) => setGridOptions({ ...gridOptions, pagination: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <span className="text-sm text-gray-700">Enable pagination</span>
              </label>

              {gridOptions.pagination && (
                <div className="ml-7">
                  <label className="block text-sm text-gray-600 mb-1">Rows per page</label>
                  <CustomDropdown
                    value={String(gridOptions.pageSize)}
                    onChange={(val) => setGridOptions({ ...gridOptions, pageSize: parseInt(val) })}
                    options={[
                      { value: '5', label: '5' },
                      { value: '10', label: '10' },
                      { value: '25', label: '25' },
                      { value: '50', label: '50' },
                      { value: '100', label: '100' },
                    ]}
                    size="sm"
                  />
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gridOptions.sortable}
                  onChange={(e) => setGridOptions({ ...gridOptions, sortable: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <span className="text-sm text-gray-700">Enable column sorting</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-gray-200">
          <div>
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSave} loading={saving}>
                {editingWidget ? 'Save Changes' : 'Add Widget'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
