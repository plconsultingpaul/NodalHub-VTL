import type { ChartSettings } from '../../../types/database';

interface BarListWidgetProps {
  data: Record<string, unknown>[];
  settings: ChartSettings;
}

export default function BarListWidget({ data, settings }: BarListWidgetProps) {
  const { label_field, value_field, color = '#3b82f6', aggregate = 'sum' } = settings;

  if (!label_field || !value_field || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        {!label_field || !value_field ? 'Configure label and value fields' : 'No data'}
      </div>
    );
  }

  const grouped = new Map<string, number>();
  for (const row of data) {
    const key = String(row[label_field] ?? '');
    const val = typeof row[value_field] === 'number' ? row[value_field] as number : parseFloat(String(row[value_field]));
    if (isNaN(val)) continue;
    if (aggregate === 'count') {
      grouped.set(key, (grouped.get(key) || 0) + 1);
    } else {
      grouped.set(key, (grouped.get(key) || 0) + val);
    }
  }

  const items = Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const maxValue = Math.max(...items.map(i => i.value), 1);

  return (
    <div className="h-full w-full p-4 overflow-y-auto">
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate mr-3">
                {item.name}
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                {item.value.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: color,
                  opacity: 1 - (index * 0.05),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
