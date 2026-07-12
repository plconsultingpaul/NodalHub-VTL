import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, FunctionSquare } from 'lucide-react';
import { useDateFunctions } from '../../hooks/useDateFunctions';
import { computeDateFunction, BASE_DATE_OPTIONS, STRING_FORMAT_OPTIONS } from '../../lib/dateFunctions';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type { DateFunctionBaseDate } from '../../types/database';

interface FunctionForm {
  name: string;
  description: string;
  base_date: DateFunctionBaseDate;
  string_format: string;
  adjust_years: number;
  adjust_months: number;
  adjust_days: number;
}

const defaultForm: FunctionForm = {
  name: '',
  description: '',
  base_date: 'today_date_only',
  string_format: 'YYYY-MM-DD',
  adjust_years: 0,
  adjust_months: 0,
  adjust_days: 0,
};

export default function Functions() {
  const { dateFunctions, loading, createDateFunction, updateDateFunction, deleteDateFunction } = useDateFunctions();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FunctionForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const sampleValue = useMemo(() => {
    return computeDateFunction(
      form.base_date,
      form.string_format,
      form.adjust_years,
      form.adjust_months,
      form.adjust_days
    );
  }, [form.base_date, form.string_format, form.adjust_years, form.adjust_months, form.adjust_days]);

  const filteredFunctions = useMemo(() => {
    if (filterType === 'all') return dateFunctions;
    return dateFunctions.filter(f => f.base_date === filterType);
  }, [dateFunctions, filterType]);

  const handleNew = () => {
    setEditingId(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const handleEdit = (fn: typeof dateFunctions[0]) => {
    setEditingId(fn.id);
    setForm({
      name: fn.name,
      description: fn.description || '',
      base_date: fn.base_date,
      string_format: fn.string_format,
      adjust_years: fn.adjust_years,
      adjust_months: fn.adjust_months,
      adjust_days: fn.adjust_days,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    if (editingId) {
      await updateDateFunction(editingId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        base_date: form.base_date,
        string_format: form.string_format,
        adjust_years: form.adjust_years,
        adjust_months: form.adjust_months,
        adjust_days: form.adjust_days,
      });
    } else {
      await createDateFunction({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        base_date: form.base_date,
        string_format: form.string_format,
        adjust_years: form.adjust_years,
        adjust_months: form.adjust_months,
        adjust_days: form.adjust_days,
      });
    }

    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    await deleteDateFunction(id);
    setDeleteConfirmId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FunctionSquare className="w-5 h-5 text-blue-600" />
            Date Functions
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Define computed date values that resolve dynamically at runtime. Use these in Pulse parameters to always get the current date.
          </p>
        </div>
        <Button onClick={handleNew} variant="primary" size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          New Function
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Filter:</label>
        <div className="w-56">
          <CustomDropdown
            value={filterType}
            onChange={setFilterType}
            options={[
              { value: 'all', label: 'All Types' },
              ...BASE_DATE_OPTIONS.map(o => ({ value: o.value, label: o.label })),
            ]}
            placeholder="All Types"
            size="sm"
          />
        </div>
      </div>

      {filteredFunctions.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <FunctionSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">No date functions defined yet.</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Create one to use dynamic dates in your Pulse parameters.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Base Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Sample Value</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFunctions.map((fn) => {
                const sample = computeDateFunction(fn.base_date, fn.string_format, fn.adjust_years, fn.adjust_months, fn.adjust_days);
                const baseDateLabel = BASE_DATE_OPTIONS.find(o => o.value === fn.base_date)?.label || fn.base_date;
                return (
                  <tr key={fn.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{fn.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{baseDateLabel}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fn.description || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-mono">
                        {sample}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(fn)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(fn.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingId ? 'Edit Date Function' : 'New Date Function'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. TodayEnd, FirstDayOfMonth"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. The Current Day at 11:59 PM"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Date</label>
              <CustomDropdown
                value={form.base_date}
                onChange={(v) => setForm({ ...form, base_date: v as DateFunctionBaseDate })}
                options={BASE_DATE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                placeholder="Select base date..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">String Format</label>
              <CustomDropdown
                value={form.string_format}
                onChange={(v) => setForm({ ...form, string_format: v })}
                options={STRING_FORMAT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                placeholder="Select format..."
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Years</label>
                <input
                  type="number"
                  value={form.adjust_years}
                  onChange={(e) => setForm({ ...form, adjust_years: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Months</label>
                <input
                  type="number"
                  value={form.adjust_months}
                  onChange={(e) => setForm({ ...form, adjust_months: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Days</label>
                <input
                  type="number"
                  value={form.adjust_days}
                  onChange={(e) => setForm({ ...form, adjust_days: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
              <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Sample Value (computed now)</div>
              <div className="text-lg font-mono text-blue-900 dark:text-blue-100">{sampleValue}</div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirmId && (
        <Modal
          isOpen={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          title="Delete Function"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Are you sure you want to delete this date function? Any Pulse parameters referencing it will need to be reconfigured.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleDelete(deleteConfirmId)}>
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
