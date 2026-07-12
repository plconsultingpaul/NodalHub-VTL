export interface NumberFormatConfig {
  type: 'number' | 'currency' | 'percentage' | 'accounting';
  decimals: number;
  thousandsSeparator: boolean;
  currencySymbol?: string;
  currencyPosition?: 'prefix' | 'suffix';
  negativeFormat?: 'minus' | 'parentheses' | 'red';
}

export function formatNumberValue(value: unknown, config: NumberFormatConfig): string | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (isNaN(num)) return null;

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  let formatted: string;

  if (config.type === 'percentage') {
    const pctVal = absNum * 100;
    formatted = pctVal.toFixed(config.decimals);
    if (config.thousandsSeparator) {
      formatted = addThousandsSep(formatted);
    }
    formatted = formatted + '%';
  } else {
    formatted = absNum.toFixed(config.decimals);
    if (config.thousandsSeparator) {
      formatted = addThousandsSep(formatted);
    }

    if (config.type === 'currency' && config.currencySymbol) {
      if (config.currencyPosition === 'suffix') {
        formatted = formatted + ' ' + config.currencySymbol;
      } else {
        formatted = config.currencySymbol + formatted;
      }
    }
  }

  if (isNegative) {
    if (config.type === 'accounting' || config.negativeFormat === 'parentheses') {
      formatted = '(' + formatted + ')';
    } else if (config.negativeFormat === 'red') {
      formatted = '-' + formatted;
    } else {
      formatted = '-' + formatted;
    }
  }

  return formatted;
}

function addThousandsSep(numStr: string): string {
  const parts = numStr.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

export const NUMBER_FORMAT_TYPES = [
  { value: '', label: 'None (Raw Value)' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'accounting', label: 'Accounting' },
];

export const DECIMAL_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
];

export const CURRENCY_SYMBOLS = [
  { value: '$', label: '$ (USD)' },
  { value: '\u20AC', label: '\u20AC (EUR)' },
  { value: '\u00A3', label: '\u00A3 (GBP)' },
  { value: '\u00A5', label: '\u00A5 (JPY/CNY)' },
  { value: 'R', label: 'R (ZAR)' },
  { value: 'A$', label: 'A$ (AUD)' },
  { value: 'C$', label: 'C$ (CAD)' },
  { value: 'CHF', label: 'CHF' },
  { value: '\u20B9', label: '\u20B9 (INR)' },
  { value: 'R$', label: 'R$ (BRL)' },
];

export const CURRENCY_POSITIONS = [
  { value: 'prefix', label: 'Before ($100)' },
  { value: 'suffix', label: 'After (100 $)' },
];

export const NEGATIVE_FORMATS = [
  { value: 'minus', label: 'Minus sign (-100)' },
  { value: 'parentheses', label: 'Parentheses (100)' },
  { value: 'red', label: 'Red text (-100)' },
];
