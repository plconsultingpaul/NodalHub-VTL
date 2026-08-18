import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { WidgetType, ChartSettings } from '../../../types/database';

const KpiWidget = lazy(() => import('./KpiWidget'));
const DonutWidget = lazy(() => import('./DonutWidget'));
const BarWidget = lazy(() => import('./BarWidget'));
const BarListWidget = lazy(() => import('./BarListWidget'));
const LineWidget = lazy(() => import('./LineWidget'));

interface WidgetRendererProps {
  widgetType: WidgetType;
  data: Record<string, unknown>[];
  settings: ChartSettings;
}

export default function WidgetRenderer({ widgetType, data, settings }: WidgetRendererProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    }>
      {widgetType === 'kpi' && <KpiWidget data={data} settings={settings} />}
      {widgetType === 'donut' && <DonutWidget data={data} settings={settings} />}
      {widgetType === 'bar' && <BarWidget data={data} settings={settings} />}
      {widgetType === 'bar_list' && <BarListWidget data={data} settings={settings} />}
      {widgetType === 'line' && <LineWidget data={data} settings={settings} />}
    </Suspense>
  );
}
