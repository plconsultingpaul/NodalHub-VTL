import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Braces, Search, X, Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { proxyFetch } from '../../lib/apiProxy';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type { QueryWithRelations, UserParameter } from '../../types/database';

interface DrilldownConfig {
  id?: string;
  query_id: string;
  display_name: string;
  link_field: string;
  sort_order: number;
  parameter_mappings: Record<string, string>;
}

interface CellConfig {
  id?: string;
  query_id: string | null;
  title: string;
  row_index: number;
  col_index: number;
  row_span: number;
  col_span: number;
  enable_row_selection: boolean;
  check_drilldown_existence: boolean;
  show_parameters_in_header: boolean;
  auto_group_by_column: string | null;
  auto_group_collapsed: boolean;
  drilldowns: DrilldownConfig[];
}

interface CellConfigPanelProps {
  cell: CellConfig | null;
  queries: QueryWithRelations[];
  availableColumns: string[];
  onUpdate: (updates: Partial<CellConfig>) => void;
  onAddDrilldown: () => void;
  onUpdateDrilldown: (index: number, updates: Partial<DrilldownConfig>) => void;
  onRemoveDrilldown: (index: number) => void;
  onSave: () => void;
  onFetchColumns?: () => void;
}

export default function CellConfigPanel({
  cell,
  queries,
  availableColumns,
  onUpdate,
  onAddDrilldown,
  onUpdateDrilldown,
  onRemoveDrilldown,
  onSave,
  onFetchColumns
}: CellConfigPanelProps) {
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [fieldPickerSearch, setFieldPickerSearch] = useState('');
  const [activeParamKey, setActiveParamKey] = useState<string | null>(null);
  const [activeDrilldownIndex, setActiveDrilldownIndex] = useState<number | null>(null);

  const selectedQuery = queries.find(q => q.id === cell?.query_id);

  useEffect(() => {
    const fetchFields = async () => {
      if (!selectedQuery) {
        setAvailableFields([]);
        return;
      }

      const queryParams = selectedQuery.query_parameters as Array<{
        key: string;
        value: string;
        enabled: boolean;
      }> | null;

      const selectParam = queryParams?.find(
        p => (p.key === '$select' || p.key === 'select') && p.enabled && p.value
      );

      if (selectParam?.value) {
        const selectedFields = selectParam.value
          .split(',')
          .map(f => f.trim())
          .filter(f => f.length > 0);
        setAvailableFields(selectedFields);
        return;
      }

      if (selectedQuery.api_spec_endpoint_id) {
        const { data } = await supabase
          .from('api_endpoint_fields')
          .select('field_name')
          .eq('api_spec_endpoint_id', selectedQuery.api_spec_endpoint_id)
          .like('field_path', '[response]%')
          .order('field_name');

        if (data && data.length > 0) {
          const fields = data.map(f => f.field_name);
          setAvailableFields(fields);
          return;
        }
      }

      const lastKnown = (selectedQuery.last_known_columns || []) as string[];
      if (lastKnown.length > 0) {
        setAvailableFields(lastKnown);
        return;
      }

      if (cell?.id) {
        const { data: cellData } = await supabase
          .from('dashboard_cells')
          .select('last_known_columns')
          .eq('id', cell.id)
          .single();
        if (cellData?.last_known_columns && cellData.last_known_columns.length > 0) {
          setAvailableFields(cellData.last_known_columns);
          return;
        }
      }

      setAvailableFields([]);
    };

    fetchFields();
  }, [selectedQuery, cell?.id]);

  const openFieldPicker = (drilldownIndex: number, paramKey: string) => {
    setActiveDrilldownIndex(drilldownIndex);
    setActiveParamKey(paramKey);
    setFieldPickerSearch('');
    setShowFieldPicker(true);
  };

  const handleFieldSelect = (fieldName: string) => {
    if (activeDrilldownIndex !== null && activeParamKey !== null) {
      const drilldown = cell?.drilldowns[activeDrilldownIndex];
      if (drilldown) {
        const newMappings = {
          ...(drilldown.parameter_mappings || {}),
          [activeParamKey]: fieldName
        };
        onUpdateDrilldown(activeDrilldownIndex, { parameter_mappings: newMappings });
      }
    }
    setShowFieldPicker(false);
    setActiveParamKey(null);
    setActiveDrilldownIndex(null);
  };

  const filteredFields = availableFields.filter(field => {
    if (!fieldPickerSearch.trim()) return true;
    return field.toLowerCase().includes(fieldPickerSearch.toLowerCase());
  });

  if (!cell) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Cell Title
        </label>
        <input
          type="text"
          value={cell.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Cell title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Main Query
        </label>
        <CustomDropdown
          value={cell.query_id || ''}
          onChange={(val) => onUpdate({ query_id: val || null })}
          options={queries.filter(q => q.app_target === 'dashboard' || q.app_target === 'both').map((query) => ({ value: query.id, label: query.name }))}
          placeholder="Select a query"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Row Span
          </label>
          <input
            type="number"
            min={1}
            max={4}
            value={cell.row_span}
            onChange={(e) => onUpdate({ row_span: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Column Span
          </label>
          <input
            type="number"
            min={1}
            max={4}
            value={cell.col_span}
            onChange={(e) => onUpdate({ col_span: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="enable_row_selection"
          checked={cell.enable_row_selection}
          onChange={(e) => onUpdate({ enable_row_selection: e.target.checked })}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="enable_row_selection" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Enable Row Selection
        </label>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="show_parameters_in_header"
          checked={cell.show_parameters_in_header}
          onChange={(e) => onUpdate({ show_parameters_in_header: e.target.checked })}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="show_parameters_in_header" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Show Parameters in Cell Header
        </label>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Auto Group By
        </label>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <CustomDropdown
                value={cell.auto_group_by_column || ''}
                onChange={(val) => onUpdate({ auto_group_by_column: val || null })}
                options={[
                  { value: '', label: 'None' },
                  ...availableColumns.map(col => ({ value: col, label: col }))
                ]}
                placeholder="Select column to group by"
                size="sm"
              />
            </div>
            {onFetchColumns && (
              <button
                type="button"
                onClick={onFetchColumns}
                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                title="Run query to fetch column list"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
          </div>
          {cell.auto_group_by_column && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto_group_collapsed"
                checked={cell.auto_group_collapsed}
                onChange={(e) => onUpdate({ auto_group_collapsed: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="auto_group_collapsed" className="text-sm text-gray-700 dark:text-gray-300">
                Start Groups Collapsed
              </label>
            </div>
          )}
          {availableColumns.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No columns available. Run the query to fetch the column list.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Drill-Down Queries
          </h3>
          <Button size="sm" variant="secondary" onClick={onAddDrilldown}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        {cell.drilldowns.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="check_drilldown_existence"
                checked={cell.check_drilldown_existence}
                onChange={(e) => onUpdate({ check_drilldown_existence: e.target.checked })}
                className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <label htmlFor="check_drilldown_existence" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pre-check drilldown data existence
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Only show expand icons on rows with data. May slow loading on large grids.
                </p>
              </div>
            </div>
          </div>
        )}

        {cell.drilldowns.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No drill-down queries configured
          </p>
        ) : (
          <div className="space-y-4">
            {cell.drilldowns.map((drilldown, index) => (
              <div
                key={drilldown.id || index}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center gap-2 mb-3">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Drilldown {index + 1}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={() => onRemoveDrilldown(index)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={drilldown.display_name}
                      onChange={(e) =>
                        onUpdateDrilldown(index, { display_name: e.target.value })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="e.g., View Contacts"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Query
                    </label>
                    <CustomDropdown
                      value={drilldown.query_id}
                      onChange={(val) =>
                        onUpdateDrilldown(index, { query_id: val })
                      }
                      options={queries.filter(q => q.app_target === 'dashboard' || q.app_target === 'both').map((query) => ({ value: query.id, label: query.name }))}
                      placeholder="Select a query"
                      size="sm"
                    />
                  </div>

                  {(() => {
                    const drilldownQuery = queries.find(q => q.id === drilldown.query_id);
                    const userParams = (drilldownQuery?.user_parameters as UserParameter[]) || [];
                    const pathParams = userParams.filter(p => p.target === 'path');

                    if (pathParams.length > 0) {
                      return (
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                            Parameter Mappings
                          </label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Map parent row fields to drilldown query parameters
                          </p>
                          {pathParams.map((param) => {
                            const paramKey = param.name.replace(/^@/, '');
                            const currentValue = drilldown.parameter_mappings?.[paramKey] || '';
                            return (
                              <div key={param.name} className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 dark:text-gray-400 w-24 truncate" title={param.name}>
                                  {param.name}
                                </span>
                                <span className="text-xs text-gray-400">&rarr;</span>
                                <input
                                  type="text"
                                  value={currentValue}
                                  onChange={(e) => {
                                    const newMappings = {
                                      ...(drilldown.parameter_mappings || {}),
                                      [paramKey]: e.target.value
                                    };
                                    onUpdateDrilldown(index, { parameter_mappings: newMappings });
                                  }}
                                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                  placeholder="Select parent field"
                                />
                                <button
                                  type="button"
                                  onClick={() => openFieldPicker(index, paramKey)}
                                  disabled={availableFields.length === 0}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Pick field"
                                >
                                  <Braces className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    return (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Link Field
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={drilldown.link_field}
                            onChange={(e) =>
                              onUpdateDrilldown(index, { link_field: e.target.value })
                            }
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            placeholder="e.g., driver_id"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDrilldownIndex(index);
                              setActiveParamKey('link_field');
                              setFieldPickerSearch('');
                              setShowFieldPicker(true);
                            }}
                            disabled={availableFields.length === 0}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Pick field"
                          >
                            <Braces className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
        <Button onClick={onSave} className="w-full">
          Save Configuration
        </Button>
      </div>

      {showFieldPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Braces className="w-4 h-4" />
                Select Parent Field
              </h4>
              <button
                onClick={() => {
                  setShowFieldPicker(false);
                  setActiveParamKey(null);
                  setActiveDrilldownIndex(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={fieldPickerSearch}
                  onChange={(e) => setFieldPickerSearch(e.target.value)}
                  placeholder="Search fields..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {filteredFields.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No matching fields found</p>
              ) : (
                filteredFields.map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => {
                      if (activeParamKey === 'link_field' && activeDrilldownIndex !== null) {
                        onUpdateDrilldown(activeDrilldownIndex, { link_field: field });
                        setShowFieldPicker(false);
                        setActiveParamKey(null);
                        setActiveDrilldownIndex(null);
                      } else {
                        handleFieldSelect(field);
                      }
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <span className="font-mono text-sm text-gray-900 dark:text-white">{field}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
