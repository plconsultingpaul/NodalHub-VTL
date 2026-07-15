import { useState, useEffect } from 'react';
import { Clock, Info, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import CustomDropdown from '../../components/ui/CustomDropdown';
import type { PulseSchedule } from '../../types/database';

type IntervalType = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

interface ScheduleRule {
  id?: string;
  label: string;
  enabled: boolean;
  cron_expression: string;
  timezone: string;
}

interface ScheduleTabProps {
  pulseId: string | null;
  schedules: PulseSchedule[];
  onSave: (schedule: Partial<PulseSchedule> & { pulse_id: string }) => Promise<{ error: string | null }>;
  onDelete: (scheduleId: string) => Promise<{ error: string | null }>;
  defaultTimezone?: string;
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
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
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
  runMode: 'once' | 'hourly_between';
  fromHour: number;
  toHour: number;
} {
  const defaults = { intervalType: 'daily' as IntervalType, every: 1, hour: 8, minute: 0, weekdays: ['1'], monthDays: ['1'], runMode: 'once' as const, fromHour: 9, toHour: 17 };
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
    if (hourPart === '*') {
      return { ...defaults, intervalType: 'hourly', every: 1, minute: min };
    }
    if (hourPart.startsWith('*/')) {
      return { ...defaults, intervalType: 'hourly', every: parseInt(hourPart.slice(2)) || 1, minute: min };
    }
    if (/^\d+$/.test(hourPart)) {
      return { ...defaults, intervalType: 'daily', every: 1, hour: parseInt(hourPart), minute: min };
    }
  }
  // Hour-range with day-of-week: e.g. "0 16-20 * * 0,1,2,3,4,5" or "0 16-20 * * 0-5"
  if (/^\d+$/.test(minPart) && /^\d+-\d+$/.test(hourPart) && domPart === '*' && dowPart !== '*') {
    const [startH, endH] = hourPart.split('-').map(Number);
    let days: string[];
    if (/^\d+-\d+$/.test(dowPart)) {
      const [from, to] = dowPart.split('-').map(Number);
      days = [];
      for (let d = from; d !== (to + 1) % 7; d = (d + 1) % 7) { days.push(String(d)); }
      days.push(String(to));
    } else {
      days = dowPart.split(',').filter(Boolean);
    }
    return { ...defaults, intervalType: 'weekly', runMode: 'hourly_between', fromHour: startH, toHour: endH, minute: parseInt(minPart), weekdays: days };
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
  customCron: string,
  runMode: 'once' | 'hourly_between' = 'once',
  fromHour: number = 9,
  toHour: number = 17
): string {
  switch (intervalType) {
    case 'minutely':
      return every === 1 ? '* * * * *' : `*/${every} * * * *`;
    case 'hourly':
      return every === 1 ? `${minute} * * * *` : `${minute} */${every} * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      if (runMode === 'hourly_between') {
        const days = weekdays.length > 0 ? weekdays.join(',') : '1';
        return `${minute} ${fromHour}-${toHour} * * ${days}`;
      }
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
  const dayNames: Record<string, string> = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat' };

  const formatTime = (h: number, m: string) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.padStart(2, '0')} ${ampm}`;
  };

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12} ${ampm}`;
  };

  if (minPart === '*' && hourPart === '*') return 'Every minute';
  if (minPart.startsWith('*/') && hourPart === '*') return `Every ${minPart.slice(2)} minutes`;
  if (/^\d+$/.test(minPart) && hourPart === '*') return `Every hour at :${minPart.padStart(2, '0')}`;
  if (/^\d+$/.test(minPart) && hourPart.startsWith('*/'))
    return `Every ${hourPart.slice(2)} hours at :${minPart.padStart(2, '0')}`;

  // Hour range with day-of-week: "0 16-20 * * 0-5"
  if (/^\d+$/.test(minPart) && /(\d+)-(\d+)/.test(hourPart) && domPart === '*') {
    const hourMatch = hourPart.match(/(\d+)-(\d+)/);
    if (hourMatch) {
      const startH = parseInt(hourMatch[1]);
      const endH = parseInt(hourMatch[2]);
      let daysDesc = 'every day';
      if (dowPart !== '*') {
        if (/^\d+-\d+$/.test(dowPart)) {
          const [ds, de] = dowPart.split('-');
          daysDesc = `${dayNames[ds]}-${dayNames[de]}`;
        } else {
          daysDesc = dowPart.split(',').map(d => dayNames[d] || d).join(', ');
        }
      }
      return `${daysDesc}, every hour between ${formatHour(startH)}-${formatHour(endH)} at :${minPart.padStart(2, '0')}`;
    }
  }

  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart === '*' && dowPart === '*') {
    return `Daily at ${formatTime(parseInt(hourPart), minPart)}`;
  }
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart === '*' && dowPart !== '*') {
    let days: string;
    if (/^\d+-\d+$/.test(dowPart)) {
      const [ds, de] = dowPart.split('-');
      days = `${dayNames[ds]}-${dayNames[de]}`;
    } else {
      days = dowPart.split(',').map(d => dayNames[d] || d).join(', ');
    }
    return `${days} at ${formatTime(parseInt(hourPart), minPart)}`;
  }
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart !== '*' && dowPart === '*') {
    const suffix = (n: number) => {
      if (n >= 11 && n <= 13) return 'th';
      const r = n % 10;
      return r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
    };
    const days = domPart.split(',').map(d => `${d}${suffix(parseInt(d))}`).join(', ');
    return `Monthly on the ${days} at ${formatTime(parseInt(hourPart), minPart)}`;
  }

  return cron;
}

function ScheduleEditor({ rule, onSave, onCancel }: {
  rule: ScheduleRule;
  onSave: (rule: ScheduleRule) => void;
  onCancel: () => void;
}) {
  const parsed = parseCronToState(rule.cron_expression);
  const [label, setLabel] = useState(rule.label);
  const [intervalType, setIntervalType] = useState<IntervalType>(parsed.intervalType);
  const [every, setEvery] = useState(parsed.every);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [weekdays, setWeekdays] = useState<string[]>(parsed.weekdays);
  const [monthDays, setMonthDays] = useState<string[]>(parsed.monthDays);
  const [customCron, setCustomCron] = useState(parsed.intervalType === 'custom' ? rule.cron_expression : '0 * * * *');
  const [timezone, setTimezone] = useState(rule.timezone || 'UTC');
  const [enabled, setEnabled] = useState(rule.enabled);
  const [runMode, setRunMode] = useState<'once' | 'hourly_between'>(parsed.runMode);
  const [fromHour, setFromHour] = useState(parsed.fromHour);
  const [toHour, setToHour] = useState(parsed.toHour);

  const currentCron = buildCron(intervalType, every, hour, minute, weekdays, monthDays, customCron, runMode, fromHour, toHour);

  const everyOptions = intervalType === 'minutely'
    ? [1, 2, 5, 10, 15, 30].map(v => ({ value: String(v), label: String(v) }))
    : [1, 2, 3, 4, 6, 8, 12].map(v => ({ value: String(v), label: String(v) }));

  const toggleWeekday = (day: string) => {
    setWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const toggleMonthDay = (day: string) => {
    setMonthDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSave = () => {
    onSave({
      id: rule.id,
      label,
      enabled,
      cron_expression: currentCron,
      timezone,
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
      {/* Label and Enable Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
            Rule Name
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Weekday evenings"
          />
        </div>
        <div className="flex items-center gap-3 pt-5">
          <span className="text-xs text-gray-500 dark:text-gray-400">Enabled</span>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
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
      </div>

      {/* Interval Config */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Interval</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Configure when this rule fires.</p>
        </div>
      </div>

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

      {((intervalType === 'daily' || intervalType === 'monthly') || (intervalType === 'weekly' && runMode === 'once')) && (
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

      {intervalType === 'weekly' && (
        <>
          {/* Run mode toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Run Mode
            </label>
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              <button
                type="button"
                onClick={() => setRunMode('once')}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  runMode === 'once'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                At a specific time
              </button>
              <button
                type="button"
                onClick={() => setRunMode('hourly_between')}
                className={`px-4 py-2 text-xs font-medium transition-colors border-l border-gray-200 dark:border-gray-600 ${
                  runMode === 'hourly_between'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                Hourly between
              </button>
            </div>
          </div>

          {/* Hourly between: From / To hour pickers */}
          {runMode === 'hourly_between' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Hour Range
              </label>
              <div className="flex items-center gap-2">
                <div className="w-40">
                  <CustomDropdown
                    value={String(fromHour)}
                    onChange={(val) => setFromHour(parseInt(val) || 0)}
                    options={HOURS}
                  />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">to</span>
                <div className="w-40">
                  <CustomDropdown
                    value={String(toHour)}
                    onChange={(val) => setToHour(parseInt(val) || 0)}
                    options={HOURS}
                  />
                </div>
              </div>
              <div className="mt-3">
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
            </div>
          )}

          {/* Days of the week */}
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
        </>
      )}

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
              { label: 'Every hour', cron: '0 * * * *' },
              { label: 'Hourly 4PM-8PM Sun-Fri', cron: '0 16-20 * * 0-5' },
              { label: 'Hourly 6AM-4PM Sat', cron: '0 6-16 * * 6' },
              { label: 'Mon-Fri 9 AM', cron: '0 9 * * 1-5' },
              { label: 'Daily 8 AM', cron: '0 8 * * *' },
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

      {/* Timezone */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
          Timezone
        </label>
        <CustomDropdown
          value={timezone}
          onChange={(val) => setTimezone(val)}
          options={TIMEZONE_OPTIONS}
        />
      </div>

      {/* Summary */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Schedule Summary</p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
            {describeCron(currentCron)}
          </p>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-mono mt-1">
            {currentCron}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          Save Rule
        </button>
      </div>
    </div>
  );
}

export default function ScheduleTab({ pulseId, schedules, onSave, onDelete, defaultTimezone }: ScheduleTabProps) {
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditingRule(null);
    setIsAdding(false);
  }, [pulseId]);

  const handleSaveRule = async (rule: ScheduleRule) => {
    if (!pulseId) return;
    setSaving(true);
    const result = await onSave({
      id: rule.id,
      pulse_id: pulseId,
      label: rule.label,
      enabled: rule.enabled,
      cron_expression: rule.cron_expression,
      timezone: rule.timezone,
    });
    setSaving(false);
    if (!result.error) {
      setEditingRule(null);
      setIsAdding(false);
    }
  };

  const handleDeleteRule = async (scheduleId: string) => {
    setSaving(true);
    await onDelete(scheduleId);
    setSaving(false);
  };

  const handleAddNew = () => {
    setEditingRule(null);
    setIsAdding(true);
  };

  const handleEditExisting = (schedule: PulseSchedule) => {
    setIsAdding(false);
    setEditingRule({
      id: schedule.id,
      label: schedule.label || '',
      enabled: schedule.enabled,
      cron_expression: schedule.cron_expression,
      timezone: schedule.timezone,
    });
  };

  if (isAdding) {
    return (
      <div className="max-w-3xl space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add Schedule Rule</h3>
        <ScheduleEditor
          rule={{ label: '', enabled: true, cron_expression: '0 8 * * *', timezone: defaultTimezone || 'UTC' }}
          onSave={handleSaveRule}
          onCancel={() => setIsAdding(false)}
        />
      </div>
    );
  }

  if (editingRule) {
    return (
      <div className="max-w-3xl space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Edit Schedule Rule</h3>
        <ScheduleEditor
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => setEditingRule(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Schedule Rules</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Add multiple schedule rules to run this pulse on different days/times.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddNew}
          disabled={saving || !pulseId}
          className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Schedule list */}
      {schedules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-xl">
          <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No schedule rules configured.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Add a rule to run this pulse automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                <div className="min-w-0">
                  {s.label && (
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.label}</p>
                  )}
                  <p className={`text-sm ${s.label ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white font-medium'}`}>
                    {describeCron(s.cron_expression)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                    {s.cron_expression} ({s.timezone})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                <button
                  type="button"
                  onClick={() => handleEditExisting(s)}
                  className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  title="Edit rule"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(s.id)}
                  disabled={saving}
                  className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                  title="Delete rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Combined summary */}
      {schedules.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Active Rules</p>
            <div className="mt-1 space-y-0.5">
              {schedules.filter(s => s.enabled).length === 0 ? (
                <p className="text-sm text-blue-700 dark:text-blue-300">All rules are disabled.</p>
              ) : (
                schedules.filter(s => s.enabled).map(s => (
                  <p key={s.id} className="text-sm text-blue-700 dark:text-blue-300">
                    {s.label ? `${s.label}: ` : ''}{describeCron(s.cron_expression)}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
