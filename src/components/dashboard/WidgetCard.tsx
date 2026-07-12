import { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, RefreshCw, Maximize2 } from 'lucide-react';
import Dropdown, { DropdownItem, DropdownDivider } from '../ui/Dropdown';
import type { DashboardWidget, ApiEndpoint } from '../../types/database';
import TabulatorWidget from './TabulatorWidget';

interface WidgetCardProps {
  widget: DashboardWidget;
  endpoint: ApiEndpoint | null;
  onEdit: (widget: DashboardWidget) => void;
  onDelete: (widgetId: string) => void;
}

export default function WidgetCard({ widget, endpoint, onEdit, onDelete }: WidgetCardProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-medium text-gray-900 truncate">{widget.title}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Dropdown
            trigger={
              <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            }
            align="right"
            width="w-40"
          >
            <DropdownItem onClick={() => onEdit(widget)}>
              <Pencil className="w-4 h-4" />
              Edit Widget
            </DropdownItem>
            <DropdownDivider />
            <DropdownItem onClick={() => onDelete(widget.id)} danger>
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownItem>
          </Dropdown>
        </div>
      </div>
      <div className="flex-1 p-4 min-h-[300px]">
        <TabulatorWidget key={refreshKey} widget={widget} endpoint={endpoint} />
      </div>
    </div>
  );
}
