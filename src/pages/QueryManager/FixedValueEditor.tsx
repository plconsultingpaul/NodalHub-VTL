import { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useFixedValues } from '../../hooks/useFixedValues';
import { useQueries } from '../../hooks/useQueries';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type {
  FixedValue,
  FixedValueType,
  FixedValueListItem,
  FixedValueDateConfig,
  FixedValueDateTimeConfig
} from '../../types/database';

interface FixedValueEditorProps {
  fixedValue: FixedValue | null;
  valueType: FixedValueType;
  onClose: (saved?: boolean) => void;
}

const BASE_DATE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'first_day_of_month', label: 'First Day of Month' },
  { value: 'last_day_of_month', label: 'Last Day of Month' },
  { value: 'first_day_of_year', label: 'First Day of Year' },
  { value: 'last_day_of_year', label: 'Last Day of Year' }
];

const DATE_FORMAT_OPTIONS = [
  { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy' },
  { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy' },
  { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd' },
  { value: 'MMMM d, yyyy', label: 'MMMM d, yyyy' }
];

const DATETIME_FORMAT_OPTIONS = [
  { value: 'MM/dd/yyyy HH:mm', label: 'MM/dd/yyyy HH:mm' },
  { value: 'MM/dd/yyyy HH:mm:ss', label: 'MM/dd/yyyy HH:mm:ss' },
  { value: 'dd/MM/yyyy HH:mm', label: 'dd/MM/yyyy HH:mm' },
  { value: 'yyyy-MM-dd HH:mm:ss', label: 'yyyy-MM-dd HH:mm:ss' },
  { value: 'YYYY-MM-DDTHH:mm:ss', label: 'YYYY-MM-DDTHH:mm:ss (ISO DateTime)' },
  { value: 'ISO8601', label: 'ISO 8601 (UTC)' }
];

const getDefaultConfig = (type: FixedValueType): FixedValueDateConfig | FixedValueDateTimeConfig | Record<string, unknown> => {
  if (type === 'date') {
    return {
      base_date: 'today',
      string_format: 'MM/dd/yyyy',
      adjust_years: 0,
      adjust_months: 0,
      adjust_days: 0
    };
  }
  if (type === 'datetime') {
    return {
      base_date: 'today',
      string_format: 'MM/dd/yyyy HH:mm',
      adjust_years: 0,
      adjust_months: 0,
      adjust_days: 0,
      adjust_hours: 0,
      adjust_minutes: 0,
      adjust_seconds: 0
    };
  }
  return {};
};

const formatDate = (date: Date, format: string): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  if (format === 'ISO8601') {
    return date.toISOString();
  }

  if (format === 'YYYY-MM-DDTHH:mm:ss') {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  return format
    .replace('yyyy', date.getFullYear().toString())
    .replace('MMMM', months[date.getMonth()])
    .replace('MM', pad(date.getMonth() + 1))
    .replace('dd', pad(date.getDate()))
    .replace('d', date.getDate().toString())
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
};

const computeSampleValue = (config: FixedValueDateConfig | FixedValueDateTimeConfig): string => {
  let date = new Date();

  if (config.base_date === 'first_day_of_month') {
    date = new Date(date.getFullYear(), date.getMonth(), 1);
  } else if (config.base_date === 'last_day_of_month') {
    date = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  } else if (config.base_date === 'first_day_of_year') {
    date = new Date(date.getFullYear(), 0, 1);
  } else if (config.base_date === 'last_day_of_year') {
    date = new Date(date.getFullYear(), 11, 31);
  }

  if (config.adjust_years) date.setFullYear(date.getFullYear() + config.adjust_years);
  if (config.adjust_months) date.setMonth(date.getMonth() + config.adjust_months);
  if (config.adjust_days) date.setDate(date.getDate() + config.adjust_days);

  if ('adjust_hours' in config && config.adjust_hours) date.setHours(date.getHours() + config.adjust_hours);
  if ('adjust_minutes' in config && config.adjust_minutes) date.setMinutes(date.getMinutes() + config.adjust_minutes);
  if ('adjust_seconds' in config && config.adjust_seconds) date.setSeconds(date.getSeconds() + config.adjust_seconds);

  return formatDate(date, config.string_format);
};

export default function FixedValueEditor({ fixedValue, valueType, onClose }: FixedValueEditorProps) {
  const { createFixedValue, updateFixedValue } = useFixedValues();
  const { queries } = useQueries();
  const isEditing = !!fixedValue;

  const [name, setName] = useState(fixedValue?.name || '');
  const [description, setDescription] = useState(fixedValue?.description || '');
  const [isList, setIsList] = useState(fixedValue?.is_list || false);
  const [singleValue, setSingleValue] = useState(fixedValue?.single_value || '');
  const [listValues, setListValues] = useState<FixedValueListItem[]>(fixedValue?.list_values || []);
  const [defaultValue, setDefaultValue] = useState(fixedValue?.default_value || '');
  const [isEditable, setIsEditable] = useState(fixedValue?.is_editable || false);
  const [config, setConfig] = useState<FixedValueDateConfig | FixedValueDateTimeConfig | Record<string, unknown>>(
    fixedValue?.config || getDefaultConfig(valueType)
  );

  const [lookupQueryId, setLookupQueryId] = useState(fixedValue?.lookup_query_id || '');
  const [lookupValueField, setLookupValueField] = useState(fixedValue?.lookup_value_field || '');
  const [lookupLabelField, setLookupLabelField] = useState(fixedValue?.lookup_label_field || '');

  const lookupQueries = queries.filter(q => q.purpose_type === 'lookup');

  const [newListValue, setNewListValue] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditing) {
      setConfig(getDefaultConfig(valueType));
    }
  }, [valueType, isEditing]);

  const handleAddListItem = () => {
    if (!newListValue.trim()) return;
    if (editingIndex !== null) {
      const updated = [...listValues];
      updated[editingIndex] = { value: newListValue.trim(), description: newListDesc.trim() };
      setListValues(updated);
      setEditingIndex(null);
    } else {
      setListValues([...listValues, { value: newListValue.trim(), description: newListDesc.trim() }]);
    }
    setNewListValue('');
    setNewListDesc('');
  };

  const handleEditListItem = (index: number) => {
    setNewListValue(listValues[index].value);
    setNewListDesc(listValues[index].description);
    setEditingIndex(index);
  };

  const handleDeleteListItem = (index: number) => {
    setListValues(listValues.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setNewListValue('');
      setNewListDesc('');
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...listValues];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setListValues(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === listValues.length - 1) return;
    const updated = [...listValues];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setListValues(updated);
  };

  const handleSortAscending = () => {
    setListValues([...listValues].sort((a, b) => a.value.localeCompare(b.value)));
  };

  const handleSortDescending = () => {
    setListValues([...listValues].sort((a, b) => b.value.localeCompare(a.value)));
  };

  const handleDeleteAll = () => {
    setListValues([]);
    setDefaultValue('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      value_type: valueType,
      is_list: valueType === 'lookup' ? false : isList,
      single_value: valueType === 'lookup' ? null : (isList ? null : singleValue),
      list_values: valueType === 'lookup' ? [] : (isList ? listValues : []),
      default_value: valueType === 'lookup' ? null : (isList ? defaultValue : null),
      is_editable: valueType === 'lookup' ? false : (isList ? isEditable : false),
      config: valueType === 'lookup' ? {} : config,
      lookup_query_id: valueType === 'lookup' ? (lookupQueryId || null) : null,
      lookup_value_field: valueType === 'lookup' ? (lookupValueField.trim() || null) : null,
      lookup_label_field: valueType === 'lookup' ? (lookupLabelField.trim() || null) : null,
    };

    let result;
    if (isEditing && fixedValue) {
      result = await updateFixedValue(fixedValue.id, data);
    } else {
      result = await createFixedValue(data);
    }

    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      onClose(true);
    }
  };

  const dateConfig = config as FixedValueDateConfig;
  const dateTimeConfig = config as FixedValueDateTimeConfig;

  const sampleValue = (valueType === 'date' || valueType === 'datetime')
    ? computeSampleValue(config as FixedValueDateConfig | FixedValueDateTimeConfig)
    : '';

  const renderDateFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Date</label>
          <CustomDropdown
            value={dateConfig.base_date}
            onChange={(val) => setConfig({ ...config, base_date: val })}
            options={BASE_DATE_OPTIONS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">String Format</label>
          <CustomDropdown
            value={dateConfig.string_format}
            onChange={(val) => setConfig({ ...config, string_format: val })}
            options={DATE_FORMAT_OPTIONS}
            autoWidth
          />
        </div>
      </div>

      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
        <span className="text-sm text-gray-600 dark:text-gray-400">Sample Value: </span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{sampleValue}</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Years</label>
          <input
            type="number"
            value={dateConfig.adjust_years}
            onChange={(e) => setConfig({ ...config, adjust_years: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Months</label>
          <input
            type="number"
            value={dateConfig.adjust_months}
            onChange={(e) => setConfig({ ...config, adjust_months: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Days</label>
          <input
            type="number"
            value={dateConfig.adjust_days}
            onChange={(e) => setConfig({ ...config, adjust_days: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
      </div>
    </>
  );

  const renderDateTimeFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Date</label>
          <CustomDropdown
            value={dateTimeConfig.base_date}
            onChange={(val) => setConfig({ ...config, base_date: val })}
            options={BASE_DATE_OPTIONS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">String Format</label>
          <CustomDropdown
            value={dateTimeConfig.string_format}
            onChange={(val) => setConfig({ ...config, string_format: val })}
            options={DATETIME_FORMAT_OPTIONS}
            autoWidth
          />
        </div>
      </div>

      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
        <span className="text-sm text-gray-600 dark:text-gray-400">Sample Value: </span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{sampleValue}</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Years</label>
          <input
            type="number"
            value={dateTimeConfig.adjust_years}
            onChange={(e) => setConfig({ ...config, adjust_years: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Months</label>
          <input
            type="number"
            value={dateTimeConfig.adjust_months}
            onChange={(e) => setConfig({ ...config, adjust_months: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Days</label>
          <input
            type="number"
            value={dateTimeConfig.adjust_days}
            onChange={(e) => setConfig({ ...config, adjust_days: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Hours</label>
          <input
            type="number"
            value={dateTimeConfig.adjust_hours || 0}
            onChange={(e) => setConfig({ ...config, adjust_hours: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Minutes</label>
          <input
            type="number"
            value={dateTimeConfig.adjust_minutes || 0}
            onChange={(e) => setConfig({ ...config, adjust_minutes: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjust Seconds</label>
          <input
            type="number"
            value={dateTimeConfig.adjust_seconds || 0}
            onChange={(e) => setConfig({ ...config, adjust_seconds: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
      </div>
    </>
  );

  const renderLookupFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lookup Query</label>
        {lookupQueries.length === 0 ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            No lookup queries available. Create a query with type "Lookup" first.
          </p>
        ) : (
          <CustomDropdown
            value={lookupQueryId}
            onChange={(val) => setLookupQueryId(val)}
            options={lookupQueries.map(q => ({ value: q.id, label: q.name }))}
            placeholder="Select a lookup query..."
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value Field</label>
          <input
            type="text"
            value={lookupValueField}
            onChange={(e) => setLookupValueField(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            placeholder="e.g. id, code"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Response field used as the option value</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label Field</label>
          <input
            type="text"
            value={lookupLabelField}
            onChange={(e) => setLookupLabelField(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            placeholder="e.g. name, description"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Response field used as the display label</p>
        </div>
      </div>

      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          When this fixed value is used in a parameter, the system will execute the selected lookup query and populate a dropdown with the results. The Value Field becomes the selected value, and the Label Field is shown to the user.
        </p>
      </div>
    </div>
  );

  const renderValueInput = () => {
    if (valueType === 'date' || valueType === 'datetime' || valueType === 'lookup') {
      return null;
    }

    return (
      <>
        <div className="flex items-center gap-4 py-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Value Type:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={!isList}
              onChange={() => setIsList(false)}
              className="text-black focus:ring-black"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Single</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={isList}
              onChange={() => setIsList(true)}
              className="text-black focus:ring-black"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">List</span>
          </label>
        </div>

        {!isList ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
            <input
              type={valueType === 'integer' || valueType === 'double' ? 'number' : 'text'}
              step={valueType === 'double' ? 'any' : valueType === 'integer' ? '1' : undefined}
              value={singleValue}
              onChange={(e) => setSingleValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              placeholder={valueType === 'integer' ? '0' : valueType === 'double' ? '0.00' : 'Enter value'}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={handleAddListItem}>
                {editingIndex !== null ? 'Update' : 'Add'}
              </Button>
              {editingIndex !== null && (
                <Button size="sm" variant="secondary" onClick={() => { setEditingIndex(null); setNewListValue(''); setNewListDesc(''); }}>
                  Cancel
                </Button>
              )}
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
              <Button size="sm" variant="secondary" onClick={handleDeleteAll} disabled={listValues.length === 0}>
                Delete All
              </Button>
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
              <Button size="sm" variant="secondary" onClick={handleSortAscending} disabled={listValues.length < 2}>
                Ascending
              </Button>
              <Button size="sm" variant="secondary" onClick={handleSortDescending} disabled={listValues.length < 2}>
                Descending
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type={valueType === 'integer' || valueType === 'double' ? 'number' : 'text'}
                step={valueType === 'double' ? 'any' : valueType === 'integer' ? '1' : undefined}
                value={newListValue}
                onChange={(e) => setNewListValue(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                placeholder="Constant Value"
              />
              <input
                type="text"
                value={newListDesc}
                onChange={(e) => setNewListDesc(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                placeholder="Description"
              />
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-md max-h-48 overflow-auto">
              {listValues.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">No values added yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Value</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Description</th>
                      <th className="px-3 py-2 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {listValues.map((item, index) => (
                      <tr
                        key={index}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${editingIndex === index ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        onClick={() => handleEditListItem(index)}
                      >
                        <td className="px-3 py-2 text-gray-900 dark:text-white">{item.value}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{item.description || '-'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoveDown(index)}
                              disabled={index === listValues.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteListItem(index)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="text-right text-xs text-gray-500 dark:text-gray-400">
              Total Constant Values: {listValues.length}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Value</label>
                <CustomDropdown
                  value={defaultValue}
                  onChange={(val) => setDefaultValue(val)}
                  options={[
                    { value: '', label: 'None' },
                    ...listValues.map((item) => ({ value: item.value, label: item.value }))
                  ]}
                  placeholder="None"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEditable}
                    onChange={(e) => setIsEditable(e.target.checked)}
                    className="rounded border-gray-300 text-black focus:ring-black"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Editable</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Edit' : 'New'} {valueType.charAt(0).toUpperCase() + valueType.slice(1)} Fixed Value
            </h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                placeholder="Enter name"
                autoFocus
              />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                placeholder="Enter description (optional)"
              />
            </div>

            {valueType === 'date' && renderDateFields()}
            {valueType === 'datetime' && renderDateTimeFields()}
            {valueType === 'lookup' && renderLookupFields()}

            {renderValueInput()}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
