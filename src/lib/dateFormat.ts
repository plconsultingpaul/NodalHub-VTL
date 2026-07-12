const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

export function formatDateValue(value: unknown, format: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value);
  const date = new Date(str);
  if (isNaN(date.getTime())) return null;

  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear();
  const day = date.getDay();
  const h24 = date.getHours();
  const h12 = h24 % 12 || 12;
  const min = date.getMinutes();
  const sec = date.getSeconds();
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
