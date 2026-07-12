import { useState } from 'react';
import { Plus, Trash2, Zap, Clock, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type { PulseInsert, PulseInputVariable, PulseVariableMapping } from '../../types/database';

interface MainTabProps {
  draft: PulseInsert;
  onChange: (updates: Partial<PulseInsert>) => void;
  pulseId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
}

const formatDate = (iso?: string | null) => {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString();
};

export default function MainTab({
  draft,
  onChange,
  pulseId,
  createdAt,
  updatedAt,
  lastRunAt,
  lastRunStatus,
}: MainTabProps) {
  const triggerType = draft.trigger_type || 'scheduled';
  const inputVariables = (draft.input_variables || []) as PulseInputVariable[];
  const [detecting, setDetecting] = useState(false);
  const [detectMessage, setDetectMessage] = useState<string | null>(null);

  const handleAddVariable = () => {
    const updated: PulseInputVariable[] = [
      ...inputVariables,
      { name: '', label: '', dataType: 'text' },
    ];
    onChange({ input_variables: updated });
  };

  const handleRemoveVariable = (index: number) => {
    const updated = inputVariables.filter((_, i) => i !== index);
    onChange({ input_variables: updated });
  };

  const handleVariableChange = (index: number, field: keyof PulseInputVariable, value: string) => {
    const updated = inputVariables.map((v, i) =>
      i === index ? { ...v, [field]: value } : v
    );
    onChange({ input_variables: updated });
  };

  const handleDetectVariables = async () => {
    if (!pulseId) {
      setDetectMessage('Save the Pulse first before detecting variables.');
      return;
    }
    setDetecting(true);
    setDetectMessage(null);

    const { data, error } = await supabase
      .from('dashboard_cell_actions')
      .select('pulse_variable_mappings')
      .eq('post_action_pulse_id', pulseId);

    if (error) {
      setDetectMessage('Failed to query linked actions.');
      setDetecting(false);
      return;
    }

    const existingNames = new Set(inputVariables.map(v => v.name));
    const newVars: PulseInputVariable[] = [];

    for (const row of data || []) {
      const mappings = (row.pulse_variable_mappings as PulseVariableMapping[]) || [];
      for (const mapping of mappings) {
        if (mapping.variableName && !existingNames.has(mapping.variableName)) {
          existingNames.add(mapping.variableName);
          newVars.push({ name: mapping.variableName, label: '', dataType: 'text' });
        }
      }
    }

    if (newVars.length === 0) {
      setDetectMessage(data?.length ? 'No new variables found. All are already defined.' : 'No linked Cell Actions found for this Pulse.');
    } else {
      onChange({ input_variables: [...inputVariables, ...newVars] });
      setDetectMessage(`Added ${newVars.length} variable${newVars.length > 1 ? 's' : ''}: ${newVars.map(v => v.name).join(', ')}`);
    }
    setDetecting(false);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={draft.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          placeholder="Daily sales summary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={draft.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          placeholder="What does this pulse do?"
        />
      </div>

      {/* Trigger Type Selector */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Trigger Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ trigger_type: 'scheduled' })}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
              triggerType === 'scheduled'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
              triggerType === 'scheduled'
                ? 'bg-blue-100 dark:bg-blue-900/40'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <Clock className={`w-4 h-4 ${
                triggerType === 'scheduled'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`} />
            </div>
            <div className="text-left">
              <p className={`text-sm font-medium ${
                triggerType === 'scheduled'
                  ? 'text-blue-900 dark:text-blue-200'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>Scheduled</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Runs on a cron schedule</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onChange({ trigger_type: 'action' })}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
              triggerType === 'action'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
              triggerType === 'action'
                ? 'bg-indigo-100 dark:bg-indigo-900/40'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <Zap className={`w-4 h-4 ${
                triggerType === 'action'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`} />
            </div>
            <div className="text-left">
              <p className={`text-sm font-medium ${
                triggerType === 'action'
                  ? 'text-indigo-900 dark:text-indigo-200'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>Action-Triggered</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Fired by a Cell Action</p>
            </div>
          </button>
        </div>
      </div>

      {/* Input Variables (only for action-triggered pulses) */}
      {triggerType === 'action' && (
        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Input Variables
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Define the variables this pulse expects to receive from the triggering action. Use these in workflow nodes as {'{{variableName}}'}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDetectVariables}
                disabled={detecting}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 rounded-md hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
              >
                {detecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Detect Variables
              </button>
              <button
                type="button"
                onClick={handleAddVariable}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Variable
              </button>
            </div>
          </div>

          {detectMessage && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded">
              {detectMessage}
            </p>
          )}

          {inputVariables.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
              No input variables defined. Add variables that the calling Cell Action will pass to this Pulse.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_100px_32px] gap-2 px-1">
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</span>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Label</span>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</span>
                <span />
              </div>
              {inputVariables.map((variable, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_100px_32px] gap-2 items-center">
                  <input
                    type="text"
                    value={variable.name}
                    onChange={(e) => handleVariableChange(index, 'name', e.target.value.replace(/\s/g, '_').toUpperCase())}
                    className="px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="TRIP_NUMBER"
                  />
                  <input
                    type="text"
                    value={variable.label}
                    onChange={(e) => handleVariableChange(index, 'label', e.target.value)}
                    className="px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Trip Number"
                  />
                  <CustomDropdown
                    value={variable.dataType}
                    onChange={(val) => handleVariableChange(index, 'dataType', val)}
                    options={[
                      { value: 'text', label: 'Text' },
                      { value: 'number', label: 'Number' },
                      { value: 'date', label: 'Date' },
                    ]}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveVariable(index)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Active</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {triggerType === 'scheduled'
              ? 'When inactive, the pulse will not run on its schedule.'
              : 'When inactive, cell actions will not trigger this pulse.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ is_active: !draft.is_active })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            draft.is_active ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              draft.is_active ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {(createdAt || updatedAt || lastRunAt) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</p>
            <p className="text-sm text-gray-900 dark:text-white mt-1">{formatDate(createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Updated</p>
            <p className="text-sm text-gray-900 dark:text-white mt-1">{formatDate(updatedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Run</p>
            <p className="text-sm text-gray-900 dark:text-white mt-1">
              {formatDate(lastRunAt)}
              {lastRunStatus && (
                <span
                  className={`ml-2 inline-block px-2 py-0.5 text-xs rounded-full ${
                    lastRunStatus === 'success'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : lastRunStatus === 'error'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {lastRunStatus}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
