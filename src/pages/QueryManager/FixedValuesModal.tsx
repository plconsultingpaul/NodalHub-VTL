import { useState } from 'react';
import { Plus, Pencil, Trash2, Calendar, Clock, Hash, Type, X, Search } from 'lucide-react';
import { useFixedValues } from '../../hooks/useFixedValues';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import FixedValueEditor from './FixedValueEditor';
import type { FixedValue, FixedValueType } from '../../types/database';

interface FixedValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_CONFIG: Record<FixedValueType, { label: string; icon: typeof Calendar; color: string }> = {
  date: { label: 'Date', icon: Calendar, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  datetime: { label: 'DateTime', icon: Clock, color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  integer: { label: 'Integer', icon: Hash, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' },
  double: { label: 'Double', icon: Hash, color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300' },
  text: { label: 'Text', icon: Type, color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300' },
  lookup: { label: 'Lookup', icon: Search, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' }
};

const FILTER_OPTIONS: { value: FixedValueType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'DateTime' },
  { value: 'integer', label: 'Integer' },
  { value: 'double', label: 'Double' },
  { value: 'text', label: 'Text' },
  { value: 'lookup', label: 'Lookup' }
];

export default function FixedValuesModal({ isOpen, onClose }: FixedValuesModalProps) {
  const { fixedValues, loading, deleteFixedValue, refetch } = useFixedValues();
  const [filterType, setFilterType] = useState<FixedValueType | 'all'>('all');
  const [editingValue, setEditingValue] = useState<FixedValue | null>(null);
  const [creatingType, setCreatingType] = useState<FixedValueType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredValues = filterType === 'all'
    ? fixedValues
    : fixedValues.filter(fv => fv.value_type === filterType);

  const handleDelete = async (id: string) => {
    await deleteFixedValue(id);
    setDeleteConfirm(null);
  };

  const handleCloseEditor = (saved?: boolean) => {
    setEditingValue(null);
    setCreatingType(null);
    if (saved) {
      refetch();
    }
  };

  const showEditor = editingValue !== null || creatingType !== null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Fixed Values</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Filter:</label>
                <CustomDropdown
                  value={filterType}
                  onChange={(val) => setFilterType(val as FixedValueType | 'all')}
                  options={FILTER_OPTIONS}
                  size="sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCreatingType('date')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Date
                </button>
                <button
                  onClick={() => setCreatingType('datetime')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-600 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  DateTime
                </button>
                <button
                  onClick={() => setCreatingType('integer')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 transition-colors"
                >
                  <Hash className="w-4 h-4" />
                  Integer
                </button>
                <button
                  onClick={() => setCreatingType('double')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-600 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50 transition-colors"
                >
                  <Hash className="w-4 h-4" />
                  Double
                </button>
                <button
                  onClick={() => setCreatingType('text')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  <Type className="w-4 h-4" />
                  Text
                </button>
                <button
                  onClick={() => setCreatingType('lookup')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-600 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  Lookup
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredValues.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Hash className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  {filterType === 'all'
                    ? 'No fixed values yet. Create one using the buttons above.'
                    : `No ${filterType} fixed values found.`}
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Value</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredValues.map((fv) => {
                      const typeConfig = TYPE_CONFIG[fv.value_type];
                      const TypeIcon = typeConfig.icon;

                      return (
                        <tr key={fv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2">
                            <span className="font-medium text-gray-900 dark:text-white">{fv.name}</span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}>
                              <TypeIcon className="w-3 h-3" />
                              {typeConfig.label}
                              {fv.is_list && ' (List)'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate">
                            {fv.value_type === 'lookup'
                              ? `Query: ${fv.lookup_query_id ? 'Configured' : 'Not set'}`
                              : fv.is_list
                                ? `${fv.list_values?.length || 0} items`
                                : fv.single_value || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                            {fv.description || '-'}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingValue(fv)}
                                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(fv.id)}
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
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>

      {showEditor && (
        <FixedValueEditor
          fixedValue={editingValue}
          valueType={creatingType || editingValue?.value_type || 'text'}
          onClose={handleCloseEditor}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Fixed Value</h4>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this fixed value? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDelete(deleteConfirm)}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
