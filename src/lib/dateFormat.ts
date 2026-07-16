const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TZ_ALIASES: Record<string, string> = {
  'UTC': 'UTC',
  'US/Eastern': 'America/New_York',
  'US/Central': 'America/Chicago',
  'US/Mountain': 'America/Denver',
  'US/Pacific': 'America/Los_Angeles',
  'Europe/London': 'Europe/London',
  'Europe/Paris': 'Europe/Paris',
  'Asia/Tokyo': 'Asia/Tokyo',
  'Australia/Sydney': 'Australia/Sydney',
};

function resolveTimezone(tz: string): string {
  return TZ_ALIASES[tz] || tz || 'UTC';
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function hasTimezoneIndicator(str: string): boolean {
  return /Z|[+-]\d{2}:\d{2}/.test(str);
}

function getPartsInTimezone(date: Date, tz: string): { y: number; m: number; d: number; h24: number; min: number; sec: number } {
  const ianaZone = resolveTimezone(tz);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';

  return {
    y: parseInt(get('year')),
    m: parseInt(get('month')) - 1,
    d: parseInt(get('day')),
    h24: parseInt(get('hour')) % 24,
    min: parseInt(get('minute')),
    sec: parseInt(get('second')),
  };
}

function parseRawDate(str: string): { y: number; m: number; d: number; h24: number; min: number; sec: number } | null {
  // ISO 8601: 2024-01-15T09:30:00Z or 2024-01-15T09:30:00+05:00 or 2024-01-15T09:30:00
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (iso) {
    return { y: +iso[1], m: +iso[2] - 1, d: +iso[3], h24: +iso[4], min: +iso[5], sec: +(iso[6] || 0) };
  }
  // Date only: 2024-01-15
  const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return { y: +dateOnly[1], m: +dateOnly[2] - 1, d: +dateOnly[3], h24: 0, min: 0, sec: 0 };
  }
  // DD/MM/YYYY or MM/DD/YYYY with optional time - parse as raw positional
  const slashed = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (slashed) {
    const p1 = +slashed[1], p2 = +slashed[2];
    let yr = +slashed[3];
    if (yr < 100) yr += 2000;
    const day = p1 > 12 ? p1 : p2 > 12 ? p2 : p1;
    const mon = p1 > 12 ? p2 : p2 > 12 ? p1 : p2;
    return { y: yr, m: mon - 1, d: day, h24: +(slashed[4] || 0), min: +(slashed[5] || 0), sec: +(slashed[6] || 0) };
  }
  return null;
}

function dayOfWeek(y: number, m: number, d: number): number {
  const t = new Date(y, m, d);
  return t.getDay();
}

export function formatDateValue(value: unknown, format: string, timezone?: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();

  // If the string has a timezone indicator (Z or +/-offset), convert to the target timezone
  if (timezone && hasTimezoneIndicator(str)) {
    const date = new Date(str);
    if (isNaN(date.getTime())) return null;
    const parts = getPartsInTimezone(date, timezone);
    return formatParts(format, parts.y, parts.m, parts.d, parts.h24, parts.min, parts.sec);
  }

  // No timezone indicator or no target timezone: extract raw components as-is
  const parsed = parseRawDate(str);
  if (!parsed) {
    const date = new Date(str);
    if (isNaN(date.getTime())) return null;
    return formatParts(format, date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
  }

  return formatParts(format, parsed.y, parsed.m, parsed.d, parsed.h24, parsed.min, parsed.sec);
}

function formatParts(format: string, y: number, m: number, d: number, h24: number, min: number, sec: number): string {
  const day = dayOfWeek(y, m, d);
  const h12 = h24 % 12 || 12;
  const ampm = h24 >= 12 ? 'pm' : 'am';
  const yy = String(y).slice(-2);

  let result = format;
  result = result.replace('dddd', DAY_NAMES[day]);
  result = result.replace('ddd', DAY_SHORT[day]);
  result = result.replace('DD', pad(d));
  result = result.replace('D', String(d));
  result = result.replace('MMMM', MONTH_NAMES[m]);
  result = result.replace('MMM', MONTH_SHORT[m]);
  result = result.replace('MM', pad(m + 1));
  result = result.replace('YYYY', String(y));
  result = result.replace('YY', yy);
  result = result.replace('HH', pad(h24));
  result = result.replace('hh', pad(h12));
  result = result.replace('h', String(h12));
  result = result.replace('mm', pad(min));
  result = result.replace('ss', pad(sec));
  result = result.replace('a', ampm);
  result = result.replace('A', ampm.toUpperCase());
  return result;
}

export interface DateFormatPreset {
  value: string;
  label: string;
  example: string;
}

export const DATE_FORMAT_PRESETS: DateFormatPreset[] = [
  { value: '', label: 'None (Raw Value)', example: '' },
  { value: 'DD/MM/YY', label: 'DD/MM/YY', example: '04/07/99' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '04/07/1999' },
  { value: 'MM/DD/YY', label: 'MM/DD/YY', example: '07/04/99' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '07/04/1999' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '1999-07-04' },
  { value: 'DD-MMM-YY', label: 'DD-MMM-YY', example: '04-Jul-99' },
  { value: 'DD-MMM-YYYY', label: 'DD-MMM-YYYY', example: '04-Jul-1999' },
  { value: 'D MMMM YYYY', label: 'D MMMM YYYY', example: '4 July 1999' },
  { value: 'MMMM D, YYYY', label: 'MMMM D, YYYY', example: 'July 4, 1999' },
  { value: 'dddd, MMMM D, YYYY', label: 'dddd, MMMM D, YYYY', example: 'Sunday, July 4, 1999' },
  { value: 'DD/MM/YY HH:mm', label: 'DD/MM/YY HH:mm', example: '04/07/99 17:01' },
  { value: 'DD/MM/YY h:mm a', label: 'DD/MM/YY h:mm a', example: '04/07/99 5:01 pm' },
  { value: 'MM/DD/YYYY HH:mm', label: 'MM/DD/YYYY HH:mm', example: '07/04/1999 17:01' },
  { value: 'MM/DD/YYYY h:mm a', label: 'MM/DD/YYYY h:mm a', example: '07/04/1999 5:01 pm' },
  { value: 'DD-MMM-YYYY HH:mm', label: 'DD-MMM-YYYY HH:mm', example: '04-Jul-1999 17:01' },
  { value: 'DD-MMM-YYYY h:mm a', label: 'DD-MMM-YYYY h:mm a', example: '04-Jul-1999 5:01 pm' },
  { value: 'MMMM D, YYYY HH:mm', label: 'MMMM D, YYYY HH:mm', example: 'July 4, 1999 17:01' },
  { value: 'MMMM D, YYYY h:mm a', label: 'MMMM D, YYYY h:mm a', example: 'July 4, 1999 5:01 pm' },
  { value: 'YYYY-MM-DD HH:mm:ss', label: 'YYYY-MM-DD HH:mm:ss', example: '1999-07-04 17:01:30' },
  { value: 'HH:mm', label: 'HH:mm', example: '17:01' },
  { value: 'h:mm a', label: 'h:mm a', example: '5:01 pm' },
  { value: 'HH:mm:ss', label: 'HH:mm:ss', example: '17:01:30' },
];
