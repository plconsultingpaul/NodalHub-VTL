import { useCallback } from 'react';
import { GitBranch, Plus, Trash2 } from 'lucide-react';
import CustomDropdown from '../../../components/ui/CustomDropdown';
import { useTheme } from '../../../contexts/ThemeContext';
import type { PulseConditionStepConfig, PulseInputVariable } from '../../../types/database';

interface ConditionConfigPanelProps {
  config: PulseConditionStepConfig | null;
  onChange: (config: PulseConditionStepConfig) => void;
  upstreamVariables: string[];
  inputVariables?: PulseInputVariable[];
}

interface ConditionRow {
  leftOperand: string;
  operator: string;
  rightOperand: string;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'array';
}

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'greater_or_equal', label: '>= (gte)' },
  { value: 'less_or_equal', label: '<= (lte)' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'is_true', label: 'is true' },
  { value: 'is_false', label: 'is false' },
];

const DATA_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'array', label: 'Array' },
];

const UNARY_OPERATORS = ['is_empty', 'is_not_empty', 'is_true', 'is_false'];

export default function ConditionConfigPanel({ config, onChange, upstreamVariables, inputVariables }: ConditionConfigPanelProps) {
  const { isDark } = useTheme();

  const current: PulseConditionStepConfig = {
    stepType: 'condition',
    name: '',
    logicMode: 'all',
    ...config,
    conditions: config?.conditions || [],
  };

  const emit = useCallback((updates: Partial<PulseConditionStepConfig>) => {
    onChange({ ...current, ...updates });
  }, [current, onChange]);

  const addCondition = () => {
    const newCondition: ConditionRow = {
      leftOperand: '',
      operator: 'equals',
      rightOperand: '',
      dataType: 'string',
    };
    emit({ conditions: [...current.conditions, newCondition] });
  };

  const removeCondition = (index: number) => {
    emit({ conditions: current.conditions.filter((_, i) => i !== index) });
  };

  const updateCondition = (index: number, updates: Partial<ConditionRow>) => {
    const updated = current.conditions.map((c, i) => (i === index ? { ...c, ...updates } : c));
    emit({ conditions: updated });
  };

  const variableOptions = upstreamVariables.map(v => ({ value: v, label: v }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <GitBranch className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Condition</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Branching Logic</p>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Name
        </label>
        <input
          type="text"
          value={current.name}
          onChange={(e) => emit({ name: e.target.value })}
          placeholder="e.g. Has Results"
          className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Logic Mode */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
          Logic Mode
        </label>
        <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
          <button
            type="button"
            onClick={() => emit({ logicMode: 'all' })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
              current.logicMode === 'all'
                ? 'bg-amber-500 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            ALL (AND)
          </button>
          <button
            type="button"
            onClick={() => emit({ logicMode: 'any' })}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
              current.logicMode === 'any'
                ? 'bg-amber-500 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            ANY (OR)
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          {current.logicMode === 'all'
            ? 'All conditions must be true to follow the Yes branch'
            : 'Any condition being true will follow the Yes branch'}
        </p>
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Conditions
          </label>
          <button
            type="button"
            onClick={addCondition}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        {current.conditions.length === 0 ? (
          <div className="text-center py-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
            <p className="text-[10px] text-gray-400 dark:text-gray-500">No conditions defined</p>
            <button
              type="button"
              onClick={addCondition}
              className="mt-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
            >
              Add first condition
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {current.conditions.map((condition, index) => (
              <div
                key={index}
                className="p-2.5 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-md space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                    #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Left Operand */}
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                    Left Operand
                  </label>
                  {variableOptions.length > 0 ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={condition.leftOperand}
                        onChange={(e) => updateCondition(index, { leftOperand: e.target.value })}
                        placeholder="e.g. {{orders_data.length}}"
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <CustomDropdown
                        value=""
                        onChange={(v) => updateCondition(index, { leftOperand: `{{${v}}}` })}
                        options={variableOptions}
                        placeholder="var"
                        dark={isDark}
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={condition.leftOperand}
                      onChange={(e) => updateCondition(index, { leftOperand: e.target.value })}
                      placeholder="e.g. {{orders_data.length}}"
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  )}
                </div>

                {/* Operator */}
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                    Operator
                  </label>
                  <CustomDropdown
                    value={condition.operator}
                    onChange={(v) => updateCondition(index, { operator: v })}
                    options={OPERATORS}
                    placeholder="Select operator..."
                    dark={isDark}
                  />
                </div>

                {/* Right Operand (hidden for unary operators) */}
                {!UNARY_OPERATORS.includes(condition.operator) && (
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                      Right Operand
                    </label>
                    {variableOptions.length > 0 ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={condition.rightOperand}
                          onChange={(e) => updateCondition(index, { rightOperand: e.target.value })}
                          placeholder="e.g. 0"
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <CustomDropdown
                          value=""
                          onChange={(v) => updateCondition(index, { rightOperand: `{{${v}}}` })}
                          options={variableOptions}
                          placeholder="var"
                          dark={isDark}
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={condition.rightOperand}
                        onChange={(e) => updateCondition(index, { rightOperand: e.target.value })}
                        placeholder="e.g. 0"
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    )}
                  </div>
                )}

                {/* Data Type */}
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                    Data Type
                  </label>
                  <CustomDropdown
                    value={condition.dataType}
                    onChange={(v) => updateCondition(index, { dataType: v as ConditionRow['dataType'] })}
                    options={DATA_TYPES}
                    dark={isDark}
                  />
                </div>

                {index < current.conditions.length - 1 && (
                  <div className="pt-1 text-center">
                    <span className="text-[10px] font-semibold text-amber-500 uppercase">
                      {current.logicMode === 'all' ? 'AND' : 'OR'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Variables Reference */}
      {inputVariables && inputVariables.length > 0 && (
        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
            Input Variables
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
            Use these in operand fields to reference data from the triggering action:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {inputVariables.map((v) => (
              <span
                key={v.name}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-mono cursor-default"
                title={`${v.label || v.name} (${v.dataType})`}
              >
                {`{{${v.name}}}`}
                <span className="text-indigo-400 dark:text-indigo-500 text-[9px] font-sans">{v.dataType}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
