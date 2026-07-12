import type { DateFunctionBaseDate } from '../types/database';

export const BASE_DATE_OPTIONS: { value: DateFunctionBaseDate; label: string }[] = [
  { value: 'today', label: 'Today (with time)' },
  { value: 'today_date_only', label: 'Today (Date Only)' },
  { value: 'first_day_of_month', label: 'First Day of Current Month' },
  { value: 'last_day_of_month', label: 'Last Day of Current Month' },
  { value: 'first_day_of_week', label: 'First Day of Current Week' },
  { value: 'last_day_of_week', label: 'Last Day of Current Week' },
  { value: 'first_day_of_year', label: 'First Day of Current Year' },
  { value: 'last_day_of_year', label: 'Last Day of Current Year' },
  { value: 'first_day_of_last_month', label: 'First Day of Last Month' },
  { value: 'last_day_of_last_month', label: 'Last Day of Last Month' },
  { value: 'first_day_of_last_year', label: 'First Day of Last Year' },
  { value: 'last_day_of_last_year', label: 'Last Day of Last Year' },
];

export const STRING_FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-07-03)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (07/03/2026)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (03/07/2026)' },
  { value: 'YYYY-MM-DDTHH:mm:ss', label: 'YYYY-MM-DDTHH:mm:ss (ISO)' },
  { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY (07-03-2026)' },
  { value: 'YYYYMMDD', label: 'YYYYMMDD (20260703)' },
];

function getBaseDate(baseDate: DateFunctionBaseDate, now: Date): Date {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const dayOfWeek = now.getDay();

  switch (baseDate) {
    case 'today':
      return new Date(now);
    case 'today_date_only':
      return new Date(year, month, day);
    case 'first_day_of_month':
      return new Date(year, month, 1);
    case 'last_day_of_month':
      return new Date(year, month + 1, 0);
    case 'first_day_of_week':
      return new Date(year, month, day - dayOfWeek);
    case 'last_day_of_week':
      return new Date(year, month, day + (6 - dayOfWeek));
    case 'first_day_of_year':
      return new Date(year, 0, 1);
    case 'last_day_of_year':
      return new Date(year, 11, 31);
    case 'first_day_of_last_month':
      return new Date(year, month - 1, 1);
    case 'last_day_of_last_month':
      return new Date(year, month, 0);
    case 'first_day_of_last_year':
      return new Date(year - 1, 0, 1);
    case 'last_day_of_last_year':
      return new Date(year - 1, 11, 31);
    default:
      return new Date(year, month, day);
  }
}

function applyAdjustments(
  date: Date,
  adjustYears: number,
  adjustMonths: number,
  adjustDays: number
): Date {
  const result = new Date(date);
  if (adjustYears !== 0) result.setFullYear(result.getFullYear() + adjustYears);
  if (adjustMonths !== 0) result.setMonth(result.getMonth() + adjustMonths);
  if (adjustDays !== 0) result.setDate(result.getDate() + adjustDays);
  return result;
}

function formatDate(date: Date, format: string): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const hh = date.getHours();
  const mm = date.getMinutes();
  const ss = date.getSeconds();

  const pad = (n: number) => String(n).padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${y}-${pad(m)}-${pad(d)}`;
    case 'MM/DD/YYYY':
      return `${pad(m)}/${pad(d)}/${y}`;
    case 'DD/MM/YYYY':
      return `${pad(d)}/${pad(m)}/${y}`;
    case 'YYYY-MM-DDTHH:mm:ss':
      return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
    case 'MM-DD-YYYY':
      return `${pad(m)}-${pad(d)}-${y}`;
    case 'YYYYMMDD':
      return `${y}${pad(m)}${pad(d)}`;
    default:
      return `${y}-${pad(m)}-${pad(d)}`;
  }
}

export function computeDateFunction(
  baseDate: DateFunctionBaseDate,
  stringFormat: string,
  adjustYears: number,
  adjustMonths: number,
  adjustDays: number,
  now?: Date
): string {
  const currentDate = now || new Date();
  const base = getBaseDate(baseDate, currentDate);
  const adjusted = applyAdjustments(base, adjustYears, adjustMonths, adjustDays);
  return formatDate(adjusted, stringFormat);
}

export const DATE_FUNCTION_PREFIX = 'fn::';

export function isDateFunctionRef(value: string): boolean {
  return value.startsWith(DATE_FUNCTION_PREFIX);
}

export function getDateFunctionId(value: string): string {
  return value.slice(DATE_FUNCTION_PREFIX.length);
}

export function makeDateFunctionRef(functionId: string): string {
  return `${DATE_FUNCTION_PREFIX}${functionId}`;
}
