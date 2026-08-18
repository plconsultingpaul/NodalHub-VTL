import { TrendingUp, TrendingDown, Minus, BarChart3, CheckCircle2, XCircle, Activity, DollarSign, Users, Package, ShoppingCart, Clock, Zap, Target, type LucideIcon } from 'lucide-react';
import type { ChartSettings } from '../../../types/database';

interface KpiWidgetProps {
  data: Record<string, unknown>[];
  settings: ChartSettings;
}

const ICON_MAP: Record<string, LucideIcon> = {
  bar_chart: BarChart3,
  check_circle: CheckCircle2,
  x_circle: XCircle,
  activity: Activity,
  dollar: DollarSign,
  users: Users,
  package: Package,
  cart: ShoppingCart,
  clock: Clock,
  zap: Zap,
  target: Target,
  trending_up: TrendingUp,
};

const COLOR_CONFIG: Record<string, {
  border: string;
  iconBg: string;
  iconText: string;
  trendBg: string;
  trendText: string;
}> = {
  blue: {
    border: 'border-t-blue-500',
    iconBg: 'bg-blue-50 dark:bg-blue-950/50',
    iconText: 'text-blue-500',
    trendBg: 'bg-blue-50 dark:bg-blue-950/30',
    trendText: 'text-blue-600 dark:text-blue-400',
  },
  emerald: {
    border: 'border-t-emerald-500',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
    iconText: 'text-emerald-500',
    trendBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    trendText: 'text-emerald-600 dark:text-emerald-400',
  },
  red: {
    border: 'border-t-red-500',
    iconBg: 'bg-red-50 dark:bg-red-950/50',
    iconText: 'text-red-500',
    trendBg: 'bg-red-50 dark:bg-red-950/30',
    trendText: 'text-red-600 dark:text-red-400',
  },
  amber: {
    border: 'border-t-amber-500',
    iconBg: 'bg-amber-50 dark:bg-amber-950/50',
    iconText: 'text-amber-500',
    trendBg: 'bg-amber-50 dark:bg-amber-950/30',
    trendText: 'text-amber-600 dark:text-amber-400',
  },
  slate: {
    border: 'border-t-slate-500',
    iconBg: 'bg-slate-50 dark:bg-slate-800/50',
    iconText: 'text-slate-500',
    trendBg: 'bg-slate-50 dark:bg-slate-800/30',
    trendText: 'text-slate-600 dark:text-slate-400',
  },
  cyan: {
    border: 'border-t-cyan-500',
    iconBg: 'bg-cyan-50 dark:bg-cyan-950/50',
    iconText: 'text-cyan-500',
    trendBg: 'bg-cyan-50 dark:bg-cyan-950/30',
    trendText: 'text-cyan-600 dark:text-cyan-400',
  },
};

function aggregateValue(data: Record<string, unknown>[], field: string, aggregate: string): number {
  const values = data.map(row => {
    const v = row[field];
    return typeof v === 'number' ? v : parseFloat(String(v));
  }).filter(v => !isNaN(v));

  if (values.length === 0) return 0;

  switch (aggregate) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'count': return data.length;
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'first': return values[0];
    default: return values.reduce((a, b) => a + b, 0);
  }
}

function formatValue(value: number, prefix?: string, suffix?: string): string {
  const formatted = value >= 1000000
    ? (value / 1000000).toFixed(1) + 'M'
    : value >= 1000
      ? (value / 1000).toFixed(1) + 'K'
      : Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return `${prefix || ''}${formatted}${suffix || ''}`;
}

export default function KpiWidget({ data, settings }: KpiWidgetProps) {
  const { value_field, aggregate = 'sum', color = 'blue', prefix, suffix, subtitle_field, trend_field, icon } = settings;

  if (!value_field || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        {!value_field ? 'Configure value field' : 'No data'}
      </div>
    );
  }

  const mainValue = aggregateValue(data, value_field, aggregate);
  const colors = COLOR_CONFIG[color] || COLOR_CONFIG.blue;
  const IconComponent = icon ? ICON_MAP[icon] : null;

  let subtitle = '';
  if (subtitle_field && data[0]) {
    subtitle = String(data[0][subtitle_field] ?? '');
  }

  let trendValue: number | null = null;
  if (trend_field && data[0]) {
    const tv = data[0][trend_field];
    trendValue = typeof tv === 'number' ? tv : parseFloat(String(tv));
    if (isNaN(trendValue)) trendValue = null;
  }

  return (
    <div className={`h-full flex flex-col justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-t-[3px] ${colors.border} overflow-hidden`}>
      <div className="flex items-start justify-between p-4 pb-1">
        <div className="flex-1 min-w-0">
          <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {formatValue(mainValue, prefix, suffix)}
          </div>
        </div>
        {IconComponent && (
          <div className={`flex-shrink-0 ml-3 p-2 rounded-lg ${colors.iconBg}`}>
            <IconComponent className={`w-5 h-5 ${colors.iconText}`} />
          </div>
        )}
      </div>

      <div className="px-4 pb-3">
        {trendValue !== null && (
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
              trendValue > 0 ? 'text-emerald-600 dark:text-emerald-400' :
              trendValue < 0 ? 'text-red-600 dark:text-red-400' :
              'text-gray-500 dark:text-gray-400'
            }`}>
              {trendValue > 0 ? <TrendingUp className="w-3 h-3" /> :
               trendValue < 0 ? <TrendingDown className="w-3 h-3" /> :
               <Minus className="w-3 h-3" />}
              {Math.abs(trendValue).toFixed(1)}%
            </span>
            {subtitle && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>
            )}
          </div>
        )}
        {!trendValue && subtitle && (
          <div className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

export { ICON_MAP };
