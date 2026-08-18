import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import type { ChartSettings } from '../../../types/database';

interface BarWidgetProps {
  data: Record<string, unknown>[];
  settings: ChartSettings;
}

export default function BarWidget({ data, settings }: BarWidgetProps) {
  const { label_field, value_field, value_fields, color = '#3b82f6', colors, aggregate = 'sum' } = settings;

  if (!label_field || (!value_field && (!value_fields || value_fields.length === 0)) || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        {!label_field ? 'Configure label field' : !value_field && !value_fields?.length ? 'Configure value field' : 'No data'}
      </div>
    );
  }

  const fields = value_fields && value_fields.length > 0 ? value_fields : [value_field!];
  const palette = colors && colors.length > 0 ? colors : ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const grouped = new Map<string, Record<string, number>>();
  for (const row of data) {
    const key = String(row[label_field] ?? '');
    if (!grouped.has(key)) {
      grouped.set(key, Object.fromEntries(fields.map(f => [f, 0])));
    }
    const bucket = grouped.get(key)!;
    for (const f of fields) {
      const val = typeof row[f] === 'number' ? row[f] as number : parseFloat(String(row[f]));
      if (!isNaN(val)) {
        if (aggregate === 'count') {
          bucket[f] = (bucket[f] || 0) + 1;
        } else {
          bucket[f] = (bucket[f] || 0) + val;
        }
      }
    }
  }

  const chartData = Array.from(grouped.entries()).map(([name, values]) => ({ name, ...values }));

  return (
    <div className="h-full w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
            angle={chartData.length > 8 ? -30 : 0}
            textAnchor={chartData.length > 8 ? 'end' : 'middle'}
            height={chartData.length > 8 ? 60 : 30}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
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
          {fields.map((field, i) => (
            <Bar
              key={field}
              dataKey={field}
              fill={fields.length === 1 ? color : palette[i % palette.length]}
              radius={[4, 4, 0, 0]}
              animationDuration={600}
              animationEasing="ease-out"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
