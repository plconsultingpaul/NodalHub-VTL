import { useState, useEffect, useCallback } from 'react';
import { Clock, Info, Zap } from 'lucide-react';
import CustomDropdown from '../../../components/ui/CustomDropdown';
import type { PulseTriggerStepConfig, PulseInputVariable } from '../../../types/database';

type IntervalType = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

interface TriggerConfigPanelProps {
  config: PulseTriggerStepConfig | null;
  onChange: (config: PulseTriggerStepConfig) => void;
  triggerType?: 'scheduled' | 'action';
  inputVariables?: PulseInputVariable[];
}

const INTERVAL_OPTIONS = [
  { value: 'minutely', label: 'Minutely' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom Cron' },
];

const WEEKDAYS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`,
}));

const MINUTES = Array.from({ length: 60 }, (_, i) => ({
  value: String(i),
  label: i.toString().padStart(2, '0'),
})).filter((_, i) => i % 5 === 0);

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern (US)' },
  { value: 'America/Chicago', label: 'Central (US)' },
  { value: 'America/Denver', label: 'Mountain (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific (US)' },
  { value: 'Europe/London', label: 'London (UK)' },
  { value: 'Europe/Paris', label: 'Paris (EU)' },
  { value: 'Europe/Berlin', label: 'Berlin (EU)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JP)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CN)' },
  { value: 'Australia/Sydney', label: 'Sydney (AU)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZ)' },
];

function parseCronToState(cron: string): {
  intervalType: IntervalType;
  every: number;
  hour: number;
  minute: number;
  weekdays: string[];
  monthDays: string[];
} {
  const defaults = { intervalType: 'daily' as IntervalType, every: 1, hour: 8, minute: 0, weekdays: ['1'], monthDays: ['1'] };
  if (!cron) return defaults;

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return { ...defaults, intervalType: 'custom' };

  const [minPart, hourPart, domPart, , dowPart] = parts;

  if (minPart.startsWith('*/') && hourPart === '*' && domPart === '*' && dowPart === '*') {
    return { ...defaults, intervalType: 'minutely', every: parseInt(minPart.slice(2)) || 1 };
  }
  if (minPart === '*' && hourPart === '*' && domPart === '*' && dowPart === '*') {
    return { ...defaults, intervalType: 'minutely', every: 1 };
  }
  if (/^\d+$/.test(minPart) && domPart === '*' && dowPart === '*') {
    const min = parseInt(minPart);
    if (hourPart === '*') return { ...defaults, intervalType: 'hourly', every: 1, minute: min };
    if (hourPart.startsWith('*/')) return { ...defaults, intervalType: 'hourly', every: parseInt(hourPart.slice(2)) || 1, minute: min };
    if (/^\d+$/.test(hourPart)) return { ...defaults, intervalType: 'daily', every: 1, hour: parseInt(hourPart), minute: min };
  }
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart === '*' && dowPart !== '*') {
    const days = dowPart.split(',').filter(Boolean);
    return { ...defaults, intervalType: 'weekly', hour: parseInt(hourPart), minute: parseInt(minPart), weekdays: days };
  }
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart !== '*' && dowPart === '*') {
    const days = domPart.split(',').filter(Boolean);
    return { ...defaults, intervalType: 'monthly', hour: parseInt(hourPart), minute: parseInt(minPart), monthDays: days };
  }

  return { ...defaults, intervalType: 'custom' };
}

function buildCron(
  intervalType: IntervalType,
  every: number,
  hour: number,
  minute: number,
  weekdays: string[],
  monthDays: string[],
  customCron: string
): string {
  switch (intervalType) {
    case 'minutely':
      return every === 1 ? '* * * * *' : `*/${every} * * * *`;
    case 'hourly':
      return every === 1 ? `${minute} * * * *` : `${minute} */${every} * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${weekdays.length > 0 ? weekdays.join(',') : '1'}`;
    case 'monthly':
      return `${minute} ${hour} ${monthDays.length > 0 ? monthDays.join(',') : '1'} * *`;
    case 'custom':
      return customCron || '0 * * * *';
  }
}

function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minPart, hourPart, domPart, , dowPart] = parts;

  if (minPart === '*' && hourPart === '*') return 'Every minute';
  if (minPart.startsWith('*/') && hourPart === '*') return `Every ${minPart.slice(2)} minutes`;
  if (/^\d+$/.test(minPart) && hourPart === '*') return `Every hour at :${minPart.padStart(2, '0')}`;
  if (/^\d+$/.test(minPart) && hourPart.startsWith('*/'))
    return `Every ${hourPart.slice(2)} hours at :${minPart.padStart(2, '0')}`;
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart === '*' && dowPart === '*') {
    const h = parseInt(hourPart);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily at ${h12}:${minPart.padStart(2, '0')} ${ampm}`;
  }
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart === '*' && dowPart !== '*') {
    const h = parseInt(hourPart);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const dayNames: Record<string, string> = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat' };
    const days = dowPart.split(',').map(d => dayNames[d] || d).join(', ');
    return `${days} at ${h12}:${minPart.padStart(2, '0')} ${ampm}`;
  }
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart !== '*' && dowPart === '*') {
    const h = parseInt(hourPart);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const suffix = (n: number) => {
      if (n >= 11 && n <= 13) return 'th';
      const r = n % 10;
      return r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
    };
    const days = domPart.split(',').map(d => `${d}${suffix(parseInt(d))}`).join(', ');
    return `Monthly on the ${days} at ${h12}:${minPart.padStart(2, '0')} ${ampm}`;
  }

  return cron;
}

function mapIntervalTypeToScheduleType(t: IntervalType): PulseTriggerStepConfig['scheduleType'] {
  switch (t) {
    case 'minutely': return 'interval';
    case 'hourly': return 'interval';
    case 'daily': return 'daily';
    case 'weekly': return 'weekly';
    case 'monthly': return 'monthly';
    case 'custom': return 'cron';
  }
}

export default function TriggerConfigPanel({ config, onChange, triggerType, inputVariables }: TriggerConfigPanelProps) {
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

  const cronExpression = config?.cronExpression || '0 8 * * *';
  const active = config?.active ?? false;
  const timezone = config?.timezone || 'UTC';

  const parsed = parseCronToState(cronExpression);
  const [intervalType, setIntervalType] = useState<IntervalType>(parsed.intervalType);
  const [every, setEvery] = useState(parsed.every);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [weekdays, setWeekdays] = useState<string[]>(parsed.weekdays);
  const [monthDays, setMonthDays] = useState<string[]>(parsed.monthDays);
  const [customCron, setCustomCron] = useState(parsed.intervalType === 'custom' ? cronExpression : '0 * * * *');

  const emitChange = useCallback((overrides: Partial<{
    cron: string;
    tz: string;
    isActive: boolean;
  }> = {}) => {
    const cron = overrides.cron ?? buildCron(intervalType, every, hour, minute, weekdays, monthDays, customCron);
    const tz = overrides.tz ?? timezone;
    const isActive = overrides.isActive ?? active;
    onChange({
      stepType: 'trigger',
      scheduleType: mapIntervalTypeToScheduleType(intervalType),
      cronExpression: cron,
      timezone: tz,
      active: isActive,
      ...(intervalType === 'minutely' || intervalType === 'hourly' ? { intervalValue: every, intervalUnit: intervalType === 'minutely' ? 'minutes' : 'hours' } : {}),
      ...(intervalType === 'daily' || intervalType === 'weekly' || intervalType === 'monthly' ? { timeOfDay: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` } : {}),
      ...(intervalType === 'weekly' ? { daysOfWeek: weekdays } : {}),
      ...(intervalType === 'monthly' ? { dayOfMonth: monthDays.length > 0 ? parseInt(monthDays[0]) : 1 } : {}),
    });
  }, [intervalType, every, hour, minute, weekdays, monthDays, customCron, timezone, active, onChange]);

  useEffect(() => {
    const newCron = buildCron(intervalType, every, hour, minute, weekdays, monthDays, customCron);
    if (newCron !== cronExpression) {
      emitChange({ cron: newCron });
    }
  }, [intervalType, every, hour, minute, weekdays, monthDays, customCron]);

  const toggleWeekday = (day: string) => {
    setWeekdays(prev => {
      const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];
      return next;
    });
  };

  const toggleMonthDay = (day: string) => {
    setMonthDays(prev => {
      const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];
      return next;
    });
  };

  const everyOptions = intervalType === 'minutely'
    ? [1, 2, 5, 10, 15, 30].map(v => ({ value: String(v), label: String(v) }))
    : [1, 2, 3, 4, 6, 8, 12].map(v => ({ value: String(v), label: String(v) }));

  const currentCron = buildCron(intervalType, every, hour, minute, weekdays, monthDays, customCron);

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

      {/* Active Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
        <div>
          <p className="text-xs font-medium text-gray-800 dark:text-gray-200">Active</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Runs automatically when enabled</p>
        </div>
        <button
          type="button"
          onClick={() => emitChange({ isActive: !active })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            active ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            active ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`} />
        </button>
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Frequency
        </label>
        <CustomDropdown
          value={intervalType}
          onChange={(val) => setIntervalType(val as IntervalType)}
          options={INTERVAL_OPTIONS}
        />
      </div>

      {/* Every N */}
      {(intervalType === 'minutely' || intervalType === 'hourly') && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
            Every
          </label>
          <div className="flex items-center gap-2">
            <CustomDropdown
              value={String(every)}
              onChange={(val) => setEvery(parseInt(val) || 1)}
              options={everyOptions}
            />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {intervalType === 'minutely' ? 'min' : 'hr'}
            </span>
          </div>
        </div>
      )}

      {/* Minute for hourly */}
      {intervalType === 'hourly' && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
            At Minute
          </label>
          <CustomDropdown
            value={String(minute)}
            onChange={(val) => setMinute(parseInt(val) || 0)}
            options={MINUTES}
            placeholder=":00"
          />
        </div>
      )}

      {/* Time for daily/weekly/monthly */}
      {(intervalType === 'daily' || intervalType === 'weekly' || intervalType === 'monthly') && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
            Run At
          </label>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-[3]">
              <CustomDropdown
                value={String(hour)}
                onChange={(val) => setHour(parseInt(val) || 0)}
                options={HOURS}
              />
            </div>
            <span className="text-xs text-gray-400">:</span>
            <div className="min-w-0 flex-[2]">
              <CustomDropdown
                value={String(minute)}
                onChange={(val) => setMinute(parseInt(val) || 0)}
                options={MINUTES}
                placeholder=":00"
              />
            </div>
          </div>
        </div>
      )}

      {/* Weekday picker */}
      {intervalType === 'weekly' && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            Days
          </label>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map(day => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleWeekday(day.value)}
                className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                  weekdays.includes(day.value)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Month day picker */}
      {intervalType === 'monthly' && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            Day of Month
          </label>
          <div className="grid grid-cols-7 gap-1">
            {MONTH_DAYS.map(day => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleMonthDay(day.value)}
                className={`w-7 h-7 rounded text-[10px] font-medium border transition-colors ${
                  monthDays.includes(day.value)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom cron */}
      {intervalType === 'custom' && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
            Cron Expression
          </label>
          <input
            type="text"
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0 * * * *"
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {[
              { label: '5m', cron: '*/5 * * * *' },
              { label: '15m', cron: '*/15 * * * *' },
              { label: '1h', cron: '0 * * * *' },
              { label: '8am', cron: '0 8 * * *' },
              { label: 'M-F 9am', cron: '0 9 * * 1,2,3,4,5' },
            ].map(preset => (
              <button
                key={preset.cron}
                type="button"
                onClick={() => setCustomCron(preset.cron)}
                className="px-2 py-0.5 text-[10px] rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timezone */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
          Timezone
        </label>
        <CustomDropdown
          value={timezone}
          onChange={(val) => emitChange({ tz: val })}
          options={TIMEZONE_OPTIONS}
        />
      </div>

      {/* Summary */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-medium text-blue-800 dark:text-blue-200">
              {describeCron(currentCron)}
            </p>
            <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 font-mono mt-0.5">
              {currentCron}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
