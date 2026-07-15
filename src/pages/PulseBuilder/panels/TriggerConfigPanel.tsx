import { Clock, Info, Zap, Lock, Calendar } from 'lucide-react';
import type { PulseTriggerStepConfig, PulseInputVariable, PulseSchedule } from '../../../types/database';

interface TriggerConfigPanelProps {
  config: PulseTriggerStepConfig | null;
  onChange: (config: PulseTriggerStepConfig) => void;
  triggerType?: 'scheduled' | 'action';
  inputVariables?: PulseInputVariable[];
  schedules?: PulseSchedule[];
}

function describeCronBrief(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [minPart, hourPart, domPart, , dowPart] = parts;
  const dayNames: Record<string, string> = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat' };

  if (minPart === '*' && hourPart === '*') return 'Every minute';
  if (minPart.startsWith('*/') && hourPart === '*') return `Every ${minPart.slice(2)} min`;
  if (/^\d+$/.test(minPart) && hourPart === '*') return `Hourly at :${minPart.padStart(2, '0')}`;
  if (/^\d+$/.test(minPart) && hourPart.includes('-') && dowPart !== '*') {
    const days = dowPart.split(',').map(d => dayNames[d] || d).join(', ');
    return `${days} hourly ${hourPart}`;
  }
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart === '*' && dowPart === '*') {
    const h = parseInt(hourPart);
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily at ${h12}:${minPart.padStart(2, '0')} ${ap}`;
  }
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && dowPart !== '*') {
    const days = dowPart.split(',').map(d => dayNames[d] || d).join(', ');
    const h = parseInt(hourPart);
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${days} at ${h12}:${minPart.padStart(2, '0')} ${ap}`;
  }
  return cron;
}

export default function TriggerConfigPanel({ config, onChange, triggerType, inputVariables, schedules }: TriggerConfigPanelProps) {
  if (triggerType === 'action') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="w-7 h-7 rounded-md bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900 dark:text-white">Action Trigger</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Triggered by Cell Actions</p>
          </div>
        </div>

        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-indigo-800 dark:text-indigo-200">
              This pulse runs when a Cell Action triggers it. No schedule is needed. Configure input variables on the Main tab.
            </p>
          </div>
        </div>

        {inputVariables && inputVariables.length > 0 && (
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Input Variables
            </label>
            <div className="space-y-1">
              {inputVariables.map((v, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                  <span className="text-xs font-mono text-indigo-700 dark:text-indigo-300 font-medium">
                    {`{{${v.name || '...'}}}`}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto">{v.dataType}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
              Use these variables in downstream nodes (Email, API, Condition).
            </p>
          </div>
        )}

        {(!inputVariables || inputVariables.length === 0) && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
            No input variables defined. Add them on the Main tab.
          </p>
        )}
      </div>
    );
  }

  // Scheduled trigger - read-only view directing to Schedule tab
  void config;
  void onChange;

  const activeSchedules = (schedules || []).filter(s => s.enabled);
  const inactiveSchedules = (schedules || []).filter(s => !s.enabled);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-white">Trigger</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Schedule Configuration</p>
        </div>
      </div>

      {/* Read-only notice */}
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-2.5">
          <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">Read Only</p>
            <p className="text-[10px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
              Use the Schedule tab to add, edit, or manage multiple schedule rules for this pulse.
            </p>
          </div>
        </div>
      </div>

      {/* Schedule rules list */}
      {schedules && schedules.length > 0 ? (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            Schedule Rules ({activeSchedules.length} active)
          </label>
          <div className="space-y-1.5">
            {schedules.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-md border ${
                  s.enabled
                    ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-150 dark:border-gray-700 opacity-60'
                }`}
              >
                <Calendar className={`w-3 h-3 flex-shrink-0 ${s.enabled ? 'text-blue-500' : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate">
                    {s.label || describeCronBrief(s.cron_expression)}
                  </p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 font-mono truncate">
                    {s.cron_expression} ({s.timezone})
                  </p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  s.enabled
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {s.enabled ? 'Active' : 'Off'}
                </span>
              </div>
            ))}
          </div>
          {inactiveSchedules.length > 0 && (
            <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1.5">
              {inactiveSchedules.length} rule(s) disabled
            </p>
          )}
        </div>
      ) : (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
          <Calendar className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto mb-1.5" />
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            No schedule rules configured yet.
          </p>
          <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">
            Go to the Schedule tab to add rules.
          </p>
        </div>
      )}
    </div>
  );
}
