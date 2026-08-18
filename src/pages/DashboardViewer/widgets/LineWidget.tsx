import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ChartSettings } from '../../../types/database';

interface LineWidgetProps {
  data: Record<string, unknown>[];
  settings: ChartSettings;
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function LineWidget({ data, settings }: LineWidgetProps) {
  const { label_field, value_field, value_fields, colors, show_legend = true } = settings;

  if (!label_field || (!value_field && (!value_fields || value_fields.length === 0)) || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        {!label_field ? 'Configure label (x-axis) field' : 'Configure value field(s)'}
      </div>
    );
  }

  const fields = value_fields && value_fields.length > 0 ? value_fields : [value_field!];
  const palette = colors && colors.length > 0 ? colors : DEFAULT_COLORS;

  const chartData = data.map(row => {
    const entry: Record<string, unknown> = { name: String(row[label_field] ?? '') };
    for (const f of fields) {
      const val = typeof row[f] === 'number' ? row[f] : parseFloat(String(row[f]));
      entry[f] = isNaN(val as number) ? 0 : val;
    }
    return entry;
  });

  return (
    <div className="h-full w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
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
          {show_legend && fields.length > 1 && (
            <Legend
              verticalAlign="top"
              iconType="line"
              iconSize={12}
              wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }}
            />
          )}
          {fields.map((field, i) => (
            <Line
              key={field}
              type="monotone"
              dataKey={field}
              stroke={palette[i % palette.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: palette[i % palette.length] }}
              activeDot={{ r: 5 }}
              animationDuration={600}
              animationEasing="ease-out"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
