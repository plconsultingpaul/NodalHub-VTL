import { useState, useEffect } from 'react';
import { Clock, Info } from 'lucide-react';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type { PulseSchedule } from '../../types/database';

type IntervalType = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

interface ScheduleTabProps {
  draft: Partial<PulseSchedule>;
  onChange: (updates: Partial<PulseSchedule>) => void;
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
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
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
}));

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

  // Minutely: */N * * * *
  if (minPart.startsWith('*/') && hourPart === '*' && domPart === '*' && dowPart === '*') {
    return { ...defaults, intervalType: 'minutely', every: parseInt(minPart.slice(2)) || 1 };
  }

  // Every minute
  if (minPart === '*' && hourPart === '*' && domPart === '*' && dowPart === '*') {
    return { ...defaults, intervalType: 'minutely', every: 1 };
  }

  // Hourly: M */N * * * or M * * * *
  if (/^\d+$/.test(minPart) && domPart === '*' && dowPart === '*') {
    const min = parseInt(minPart);
    if (hourPart === '*') {
      return { ...defaults, intervalType: 'hourly', every: 1, minute: min };
    }
    if (hourPart.startsWith('*/')) {
      return { ...defaults, intervalType: 'hourly', every: parseInt(hourPart.slice(2)) || 1, minute: min };
    }
    // Daily: M H * * *
    if (/^\d+$/.test(hourPart) && domPart === '*' && dowPart === '*') {
      return { ...defaults, intervalType: 'daily', every: 1, hour: parseInt(hourPart), minute: min };
    }
    // Weekly: M H * * D,D
    if (/^\d+$/.test(hourPart) && domPart === '*' && dowPart !== '*') {
      const days = dowPart.split(',').filter(Boolean);
      return { ...defaults, intervalType: 'weekly', hour: parseInt(hourPart), minute: min, weekdays: days };
    }
    // Monthly: M H D * *
    if (/^\d+$/.test(hourPart) && domPart !== '*' && dowPart === '*') {
      const days = domPart.split(',').filter(Boolean);
      return { ...defaults, intervalType: 'monthly', hour: parseInt(hourPart), minute: min, monthDays: days };
    }
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

export default function ScheduleTab({ draft, onChange }: ScheduleTabProps) {
  const enabled = draft.enabled ?? false;
  const cronExpression = draft.cron_expression || '0 8 * * *';

  const parsed = parseCronToState(cronExpression);
  const [intervalType, setIntervalType] = useState<IntervalType>(parsed.intervalType);
  const [every, setEvery] = useState(parsed.every);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [weekdays, setWeekdays] = useState<string[]>(parsed.weekdays);
  const [monthDays, setMonthDays] = useState<string[]>(parsed.monthDays);
  const [customCron, setCustomCron] = useState(parsed.intervalType === 'custom' ? cronExpression : '0 * * * *');

  useEffect(() => {
    const newCron = buildCron(intervalType, every, hour, minute, weekdays, monthDays, customCron);
    if (newCron !== cronExpression) {
      onChange({ cron_expression: newCron });
    }
  }, [intervalType, every, hour, minute, weekdays, monthDays, customCron]);

  const toggleWeekday = (day: string) => {
    setWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const toggleMonthDay = (day: string) => {
    setMonthDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const everyOptions = intervalType === 'minutely'
    ? [1, 2, 5, 10, 15, 30].map(v => ({ value: String(v), label: String(v) }))
    : [1, 2, 3, 4, 6, 8, 12].map(v => ({ value: String(v), label: String(v) }));

  return (
    <div className="max-w-3xl space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Schedule Enabled</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            When enabled, the pulse will run automatically at the configured interval.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ enabled: !enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Interval Configuration */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Interval</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Configure how often this pulse runs.</p>
          </div>
        </div>

        {/* Interval Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
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
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Every
              </label>
              <div className="flex items-center gap-2">
                <CustomDropdown
                  value={String(every)}
                  onChange={(val) => setEvery(parseInt(val) || 1)}
                  options={everyOptions}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {intervalType === 'minutely' ? 'minute(s)' : 'hour(s)'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Minute picker for hourly */}
        {intervalType === 'hourly' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              At minute
            </label>
            <div className="w-24">
              <CustomDropdown
                value={String(minute)}
                onChange={(val) => setMinute(parseInt(val) || 0)}
                options={MINUTES.filter((_, i) => i % 5 === 0)}
                placeholder=":00"
              />
            </div>
          </div>
        )}

        {/* Time picker for daily/weekly/monthly */}
        {(intervalType === 'daily' || intervalType === 'weekly' || intervalType === 'monthly') && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Run at
            </label>
            <div className="flex items-center gap-2">
              <div className="w-40">
                <CustomDropdown
                  value={String(hour)}
                  onChange={(val) => setHour(parseInt(val) || 0)}
                  options={HOURS}
                />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">:</span>
              <div className="w-24">
                <CustomDropdown
                  value={String(minute)}
                  onChange={(val) => setMinute(parseInt(val) || 0)}
                  options={MINUTES.filter((_, i) => i % 5 === 0)}
                  placeholder=":00"
                />
              </div>
            </div>
          </div>
        )}

        {/* Weekday picker */}
        {intervalType === 'weekly' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Days of the week
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(day => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWeekday(day.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    weekdays.includes(day.value)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Days of the month
            </label>
            <div className="grid grid-cols-7 gap-1.5 max-w-xs">
              {MONTH_DAYS.map(day => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleMonthDay(day.value)}
                  className={`w-8 h-8 rounded text-xs font-medium border transition-colors ${
                    monthDays.includes(day.value)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom cron input */}
        {intervalType === 'custom' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Cron expression
            </label>
            <input
              type="text"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0 * * * *"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Standard 5-field cron: minute, hour, day-of-month, month, day-of-week.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: 'Every minute', cron: '* * * * *' },
                { label: 'Every 5 min', cron: '*/5 * * * *' },
                { label: 'Every 15 min', cron: '*/15 * * * *' },
                { label: 'Every hour', cron: '0 * * * *' },
                { label: 'Daily 8 AM', cron: '0 8 * * *' },
                { label: 'Mon-Fri 9 AM', cron: '0 9 * * 1,2,3,4,5' },
              ].map(preset => (
                <button
                  key={preset.cron}
                  type="button"
                  onClick={() => setCustomCron(preset.cron)}
                  className="px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Schedule Summary</p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
            {describeCron(cronExpression)}
          </p>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-mono mt-1">
            {cronExpression}
          </p>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
          Timezone
        </label>
        <CustomDropdown
          value={draft.timezone || 'UTC'}
          onChange={(val) => onChange({ timezone: val })}
          options={[
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
          ]}
        />
      </div>
    </div>
  );
}
