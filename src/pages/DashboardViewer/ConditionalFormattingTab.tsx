import { useState, useMemo } from 'react';
import { Plus, X, ChevronUp, ChevronDown, Copy, Table2, Columns3, ChevronRight, RotateCcw } from 'lucide-react';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import DatePicker from '../../components/ui/DatePicker';
import { useFixedValues } from '../../hooks/useFixedValues';
import type {
  GridCellFormattingRules,
  ConditionalFormatting,
  ConditionalFormattingRule,
  ConditionalFormattingCondition,
  ConditionalDataType,
  ConditionalComparison,
  BlinkSpeed,
  FixedValue
} from '../../types/database';

interface ConditionalFormattingTabProps {
  columns: string[];
  formattingRules: GridCellFormattingRules;
  onFormattingChange: (rules: GridCellFormattingRules) => void;
}

const DATA_TYPES: ConditionalDataType[] = [
  'Text', 'Text (Fixed)',
  'Date', 'Date (Fixed)',
  'Integer', 'Integer (Fixed)',
  'Double', 'Double (Fixed)'
];

const COMPARISONS: ConditionalComparison[] = [
  'Equals', 'Not Equals',
  'Greater Than', 'Greater Than or Equal',
  'Less Than', 'Less Than or Equal',
  'Contains', 'Not Contains',
  'Starts With', 'Doesnt Start With',
  'Is Null or Empty',
  'Is Like', 'Is Not Like'
];

const BLINK_SPEEDS: { value: BlinkSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Medium' },
  { value: 'fast', label: 'Fast' }
];

const FONT_FAMILIES = [
  { value: '', label: 'Default' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
];

const COLOR_PALETTE = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
  ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 rounded border border-gray-300 dark:border-gray-600 flex items-center gap-2 px-2"
      >
        <div
          className="w-5 h-5 rounded border border-gray-300"
          style={{ backgroundColor: value || '#ffffff' }}
        />
        <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{value || 'None'}</span>
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-0.5">
            {COLOR_PALETTE.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-0.5">
                {row.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => { onChange(color); setIsOpen(false); }}
                    className={`w-4 h-4 rounded-sm border transition-transform hover:scale-110 ${
                      value?.toLowerCase() === color.toLowerCase()
                        ? 'border-blue-500 ring-1 ring-blue-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { onChange(''); setIsOpen(false); }}
            className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function getFixedValuesForDataType(dataType: ConditionalDataType, fixedValues: FixedValue[]): FixedValue[] {
  const typeMap: Record<string, string> = {
    'Text (Fixed)': 'text',
    'Date (Fixed)': 'date',
    'Integer (Fixed)': 'integer',
    'Double (Fixed)': 'double'
  };
  const mappedType = typeMap[dataType];
  if (!mappedType) return [];
  return fixedValues.filter(fv => fv.value_type === mappedType);
}

export default function ConditionalFormattingTab({
  columns,
  formattingRules,
  onFormattingChange
}: ConditionalFormattingTabProps) {
  const { fixedValues } = useFixedValues();
  const [selectedTarget, setSelectedTarget] = useState<'grid' | string>('grid');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [expandedColumns, setExpandedColumns] = useState(true);

  const conditionalFormatting = formattingRules.conditionalFormatting || [];

  const targetsWithRules = useMemo(() => {
    const targets = new Set<string>();
    conditionalFormatting.forEach(cf => {
      if (cf.rules.length > 0) {
        targets.add(cf.target);
      }
    });
    return targets;
  }, [conditionalFormatting]);

  const currentTargetFormatting = useMemo(() => {
    return conditionalFormatting.find(cf => cf.target === selectedTarget);
  }, [conditionalFormatting, selectedTarget]);

  const selectedRule = useMemo(() => {
    if (!selectedRuleId || !currentTargetFormatting) return null;
    return currentTargetFormatting.rules.find(r => r.id === selectedRuleId) || null;
  }, [currentTargetFormatting, selectedRuleId]);

  const updateConditionalFormatting = (newFormatting: ConditionalFormatting[]) => {
    onFormattingChange({
      ...formattingRules,
      conditionalFormatting: newFormatting
    });
  };

  const addRule = () => {
    const newRule: ConditionalFormattingRule = {
      id: generateId(),
      name: `New Rule ${(currentTargetFormatting?.rules.length || 0) + 1}`,
      sequence: (currentTargetFormatting?.rules.length || 0) + 1,
      enabled: true,
      conditionType: 'AND',
      conditions: [],
      formatting: {}
    };

    if (currentTargetFormatting) {
      const updated = conditionalFormatting.map(cf =>
        cf.target === selectedTarget
          ? { ...cf, rules: [...cf.rules, newRule] }
          : cf
      );
      updateConditionalFormatting(updated);
    } else {
      updateConditionalFormatting([
        ...conditionalFormatting,
        { target: selectedTarget, rules: [newRule] }
      ]);
    }
    setSelectedRuleId(newRule.id);
  };

  const removeRule = () => {
    if (!selectedRuleId || !currentTargetFormatting) return;
    const updated = conditionalFormatting.map(cf =>
      cf.target === selectedTarget
        ? { ...cf, rules: cf.rules.filter(r => r.id !== selectedRuleId) }
        : cf
    ).filter(cf => cf.rules.length > 0);
    updateConditionalFormatting(updated);
    setSelectedRuleId(null);
  };

  const moveRule = (direction: 'up' | 'down') => {
    if (!selectedRuleId || !currentTargetFormatting) return;
    const rules = [...currentTargetFormatting.rules];
    const index = rules.findIndex(r => r.id === selectedRuleId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === rules.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [rules[index], rules[newIndex]] = [rules[newIndex], rules[index]];
    rules.forEach((r, i) => { r.sequence = i + 1; });

    const updated = conditionalFormatting.map(cf =>
      cf.target === selectedTarget ? { ...cf, rules } : cf
    );
    updateConditionalFormatting(updated);
  };

  const copyRule = () => {
    if (!selectedRule || !currentTargetFormatting) return;
    const newRule: ConditionalFormattingRule = {
      ...JSON.parse(JSON.stringify(selectedRule)),
      id: generateId(),
      name: `${selectedRule.name} (Copy)`,
      sequence: currentTargetFormatting.rules.length + 1
    };
    const updated = conditionalFormatting.map(cf =>
      cf.target === selectedTarget
        ? { ...cf, rules: [...cf.rules, newRule] }
        : cf
    );
    updateConditionalFormatting(updated);
    setSelectedRuleId(newRule.id);
  };

  const updateRule = (updates: Partial<ConditionalFormattingRule>) => {
    if (!selectedRuleId) return;
    const updated = conditionalFormatting.map(cf =>
      cf.target === selectedTarget
        ? { ...cf, rules: cf.rules.map(r => r.id === selectedRuleId ? { ...r, ...updates } : r) }
        : cf
    );
    updateConditionalFormatting(updated);
  };

  const addCondition = () => {
    if (!selectedRule) return;
    const newCondition: ConditionalFormattingCondition = {
      id: generateId(),
      column: columns[0] || '',
      dataType: 'Text',
      comparison: 'Equals',
      value: ''
    };
    updateRule({ conditions: [...selectedRule.conditions, newCondition] });
  };

  const updateCondition = (conditionId: string, updates: Partial<ConditionalFormattingCondition>) => {
    if (!selectedRule) return;
    updateRule({
      conditions: selectedRule.conditions.map(c =>
        c.id === conditionId ? { ...c, ...updates } : c
      )
    });
  };

  const removeCondition = (conditionId: string) => {
    if (!selectedRule) return;
    updateRule({
      conditions: selectedRule.conditions.filter(c => c.id !== conditionId)
    });
  };

  const formatColumnName = (field: string): string => {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="flex flex-1 gap-4 min-h-0">
      <div className="w-64 flex-shrink-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col">
        <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Target
          </span>
        </div>
        <div className="overflow-y-auto flex-1">
          <button
            onClick={() => { setSelectedTarget('grid'); setSelectedRuleId(null); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
              selectedTarget === 'grid'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Table2 className={`w-4 h-4 ${targetsWithRules.has('grid') ? 'text-green-500' : ''}`} />
            <span className="font-medium">Grid (All Rows)</span>
          </button>

          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setExpandedColumns(!expandedColumns)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {expandedColumns ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Columns3 className="w-4 h-4" />
              <span className="font-medium">Columns</span>
            </button>

            {expandedColumns && (
              <div className="pl-6">
                {columns.map(col => (
                  <button
                    key={col}
                    onClick={() => { setSelectedTarget(col); setSelectedRuleId(null); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                      selectedTarget === col
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      targetsWithRules.has(col) ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'
                    }`} />
                    <span className="truncate">{formatColumnName(col)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-56 flex-shrink-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col">
        <div className="bg-gray-50 dark:bg-gray-800 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-1">
          <button
            onClick={addRule}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-green-600"
            title="Add Rule"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={removeRule}
            disabled={!selectedRuleId}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-red-600 disabled:opacity-40"
            title="Remove Rule"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={() => moveRule('up')}
            disabled={!selectedRuleId}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40"
            title="Move Up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => moveRule('down')}
            disabled={!selectedRuleId}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40"
            title="Move Down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={copyRule}
            disabled={!selectedRuleId}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40"
            title="Copy Rule"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {(currentTargetFormatting?.rules || [])
            .sort((a, b) => a.sequence - b.sequence)
            .map(rule => (
              <button
                key={rule.id}
                onClick={() => setSelectedRuleId(rule.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors border-b border-gray-100 dark:border-gray-700 ${
                  selectedRuleId === rule.id
                    ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    const updated = conditionalFormatting.map(cf =>
                      cf.target === selectedTarget
                        ? { ...cf, rules: cf.rules.map(r => r.id === rule.id ? { ...r, enabled: e.target.checked } : r) }
                        : cf
                    );
                    updateConditionalFormatting(updated);
                  }}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="truncate flex-1">{rule.name}</span>
              </button>
            ))}
          {(!currentTargetFormatting || currentTargetFormatting.rules.length === 0) && (
            <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">
              No rules defined
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        {selectedRule ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Selected Rule</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateRule({ formatting: {}, conditions: [] })}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={selectedRule.name}
                  onChange={(e) => updateRule({ name: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Condition Type
                </label>
                <CustomDropdown
                  value={selectedRule.conditionType}
                  onChange={(val) => updateRule({ conditionType: val as 'AND' | 'OR' })}
                  options={[
                    { value: 'AND', label: 'All conditions must be true (AND)' },
                    { value: 'OR', label: 'One condition must be true (OR)' },
                  ]}
                  size="sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Conditions</label>
                <button
                  onClick={addCondition}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Condition
                </button>
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-400">Column</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-400">Data Type</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-400">Comparison</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-400">Value</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRule.conditions.map(condition => {
                      const isFixedType = condition.dataType.includes('(Fixed)');
                      const availableFixedValues = isFixedType
                        ? getFixedValuesForDataType(condition.dataType, fixedValues)
                        : [];

                      return (
                        <tr key={condition.id} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="px-1 py-1 min-w-[180px]">
                            <CustomDropdown
                              value={condition.column}
                              onChange={(val) => updateCondition(condition.id, { column: val })}
                              options={columns.map(col => ({ value: col, label: formatColumnName(col) }))}
                              size="sm"
                              autoWidth
                            />
                          </td>
                          <td className="px-1 py-1">
                            <CustomDropdown
                              value={condition.dataType}
                              onChange={(val) => updateCondition(condition.id, {
                                dataType: val as ConditionalDataType,
                                value: '',
                                fixedValueId: undefined
                              })}
                              options={DATA_TYPES.map(dt => ({ value: dt, label: dt }))}
                              size="sm"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <CustomDropdown
                              value={condition.comparison}
                              onChange={(val) => updateCondition(condition.id, { comparison: val as ConditionalComparison })}
                              options={COMPARISONS.map(c => ({ value: c, label: c }))}
                              size="sm"
                            />
                          </td>
                          <td className="px-1 py-1">
                            {isFixedType ? (
                              <CustomDropdown
                                value={condition.fixedValueId || ''}
                                onChange={(val) => updateCondition(condition.id, {
                                  fixedValueId: val,
                                  value: availableFixedValues.find(fv => fv.id === val)?.name || ''
                                })}
                                options={availableFixedValues.map(fv => ({ value: fv.id, label: fv.name }))}
                                placeholder="Select Fixed Value"
                                size="sm"
                              />
                            ) : condition.dataType === 'Date' || condition.dataType === 'Date (Fixed)' ? (
                              <DatePicker
                                value={condition.value}
                                onChange={(v) => updateCondition(condition.id, { value: v })}
                                placeholder="Select date"
                                size="sm"
                              />
                            ) : (
                              <input
                                type={condition.dataType === 'Integer' || condition.dataType === 'Double' ? 'number' : 'text'}
                                value={condition.value}
                                onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                                disabled={condition.comparison === 'Is Null or Empty'}
                                className="w-full px-1 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white disabled:opacity-50"
                                step={condition.dataType === 'Double' ? '0.01' : undefined}
                              />
                            )}
                          </td>
                          <td className="px-1 py-1">
                            <button
                              onClick={() => removeCondition(condition.id)}
                              className="p-0.5 text-red-500 hover:text-red-700"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {selectedRule.conditions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-center text-gray-400 dark:text-gray-500">
                          No conditions. Click "Add Condition" to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3 block">Appearance</label>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <ColorPicker
                  label="Background Colour"
                  value={selectedRule.formatting.backgroundColor || ''}
                  onChange={(color) => updateRule({ formatting: { ...selectedRule.formatting, backgroundColor: color } })}
                />
                <ColorPicker
                  label="Text Colour"
                  value={selectedRule.formatting.textColor || ''}
                  onChange={(color) => updateRule({ formatting: { ...selectedRule.formatting, textColor: color } })}
                />
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Font</label>
                  <CustomDropdown
                    value={selectedRule.formatting.fontFamily || ''}
                    onChange={(val) => updateRule({ formatting: { ...selectedRule.formatting, fontFamily: val } })}
                    options={FONT_FAMILIES.map(f => ({ value: f.value, label: f.label }))}
                    size="sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => updateRule({ formatting: { ...selectedRule.formatting, bold: !selectedRule.formatting.bold } })}
                  className={`px-3 py-1.5 text-sm font-bold border rounded transition-colors ${
                    selectedRule.formatting.bold
                      ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  B
                </button>
                <button
                  onClick={() => updateRule({ formatting: { ...selectedRule.formatting, italic: !selectedRule.formatting.italic } })}
                  className={`px-3 py-1.5 text-sm italic border rounded transition-colors ${
                    selectedRule.formatting.italic
                      ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  I
                </button>
                <button
                  onClick={() => updateRule({ formatting: { ...selectedRule.formatting, underline: !selectedRule.formatting.underline } })}
                  className={`px-3 py-1.5 text-sm underline border rounded transition-colors ${
                    selectedRule.formatting.underline
                      ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  U
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="blinking-enabled"
                    checked={selectedRule.formatting.blinking?.enabled || false}
                    onChange={(e) => updateRule({
                      formatting: {
                        ...selectedRule.formatting,
                        blinking: {
                          enabled: e.target.checked,
                          speed: selectedRule.formatting.blinking?.speed || 'medium'
                        }
                      }
                    })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <label htmlFor="blinking-enabled" className="text-xs text-gray-600 dark:text-gray-400">
                    Enable Blinking
                  </label>
                  {selectedRule.formatting.blinking?.enabled && (
                    <CustomDropdown
                      value={selectedRule.formatting.blinking.speed}
                      onChange={(val) => updateRule({
                        formatting: {
                          ...selectedRule.formatting,
                          blinking: {
                            enabled: true,
                            speed: val as BlinkSpeed
                          }
                        }
                      })}
                      options={BLINK_SPEEDS.map(s => ({ value: s.value, label: s.label }))}
                      size="sm"
                      className="ml-2"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="image-placeholder"
                    checked={!!selectedRule.formatting.imagePlaceholder}
                    onChange={(e) => updateRule({
                      formatting: {
                        ...selectedRule.formatting,
                        imagePlaceholder: e.target.checked ? 'placeholder' : undefined
                      }
                    })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <label htmlFor="image-placeholder" className="text-xs text-gray-600 dark:text-gray-400">
                    Add Image To Cells
                  </label>
                  <span className="text-xs text-gray-400">(Coming soon)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Preview</label>
                <div
                  className={`px-4 py-2 border border-gray-300 dark:border-gray-600 rounded ${
                    selectedRule.formatting.blinking?.enabled ? `animate-blink-${selectedRule.formatting.blinking.speed}` : ''
                  }`}
                  style={{
                    backgroundColor: selectedRule.formatting.backgroundColor || undefined,
                    color: selectedRule.formatting.textColor || undefined,
                    fontFamily: selectedRule.formatting.fontFamily || undefined,
                    fontWeight: selectedRule.formatting.bold ? 'bold' : undefined,
                    fontStyle: selectedRule.formatting.italic ? 'italic' : undefined,
                    textDecoration: selectedRule.formatting.underline ? 'underline' : undefined
                  }}
                >
                  Example Text
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <p className="text-sm">Select a rule to edit or add a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
