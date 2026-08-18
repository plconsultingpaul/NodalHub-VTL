import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { ChartSettings } from '../../../types/database';

interface DonutWidgetProps {
  data: Record<string, unknown>[];
  settings: ChartSettings;
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function DonutWidget({ data, settings }: DonutWidgetProps) {
  const { category_field, value_field, colors, show_legend = true, aggregate = 'sum' } = settings;

  if (!category_field || !value_field || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        {!category_field || !value_field ? 'Configure category and value fields' : 'No data'}
      </div>
    );
  }

  const grouped = new Map<string, number>();
  for (const row of data) {
    const key = String(row[category_field] ?? 'Other');
    const val = typeof row[value_field] === 'number' ? row[value_field] as number : parseFloat(String(row[value_field]));
    if (isNaN(val)) continue;
    if (aggregate === 'count') {
      grouped.set(key, (grouped.get(key) || 0) + 1);
    } else {
      grouped.set(key, (grouped.get(key) || 0) + val);
    }
  }

  const chartData = Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
  const palette = colors && colors.length > 0 ? colors : DEFAULT_COLORS;

  return (
    <div className="h-full w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            animationDuration={600}
            animationEasing="ease-out"
          >
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '13px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
            formatter={(value: number) => [value.toLocaleString(), '']}
          />
          {show_legend && (
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
