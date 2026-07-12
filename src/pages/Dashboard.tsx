import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useWidgets } from '../hooks/useWidgets';
import { useEndpoints } from '../hooks/useEndpoints';
import { useAuth } from '../contexts/AuthContext';
import WidgetCard from '../components/dashboard/WidgetCard';
import AddWidgetModal from '../components/dashboard/AddWidgetModal';
import Button from '../components/ui/Button';
import { Plus, LayoutGrid, Settings } from 'lucide-react';
import type { Dashboard as DashboardType, DashboardWidget } from '../types/database';

export default function Dashboard() {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const navigate = useNavigate();
  const { activeCompany } = useAuth();
  const { widgets, loading: widgetsLoading, createWidget, updateWidget, deleteWidget } = useWidgets(dashboardId);
  const { endpoints, loading: endpointsLoading } = useEndpoints();

  const [dashboard, setDashboard] = useState<DashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);

  const canEdit = activeCompany?.role === 'Admin';

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!dashboardId) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('id', dashboardId)
        .maybeSingle();

      if (error || !data) {
        navigate('/');
        return;
      }

      setDashboard(data);
      setLoading(false);
    };

    fetchDashboard();
  }, [dashboardId, navigate]);

  const handleSaveWidget = async (widgetData: Partial<DashboardWidget>) => {
    if (!dashboardId) return;

    if (editingWidget) {
      await updateWidget(editingWidget.id, widgetData);
    } else {
      await createWidget({
        dashboard_id: dashboardId,
        title: widgetData.title || 'New Widget',
        endpoint_id: widgetData.endpoint_id || null,
        position_x: 0,
        position_y: widgets.length,
        width: 6,
        height: 4,
        column_config: widgetData.column_config || [],
        grid_options: widgetData.grid_options || { pagination: true, pageSize: 10, sortable: true }
      });
    }

    setShowAddWidget(false);
    setEditingWidget(null);
  };

  const handleEditWidget = (widget: DashboardWidget) => {
    setEditingWidget(widget);
    setShowAddWidget(true);
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (confirm('Are you sure you want to delete this widget?')) {
      await deleteWidget(widgetId);
    }
  };

  if (loading || widgetsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard not found</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">The dashboard you're looking for doesn't exist.</p>
          <Button className="mt-4" onClick={() => navigate('/')}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
        <div className="px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{dashboard.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowAddWidget(true)}>
                <Plus className="w-4 h-4" />
                Add Widget
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="p-8">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-6">
              <LayoutGrid className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No widgets yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
              Add your first widget to start displaying data from your configured API endpoints.
            </p>
            {canEdit && (
              <Button onClick={() => setShowAddWidget(true)}>
                <Plus className="w-4 h-4" />
                Add Your First Widget
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {widgets.map((widget) => (
              <WidgetCard
                key={widget.id}
                widget={widget}
                endpoint={endpoints.find(e => e.id === widget.endpoint_id) || null}
                onEdit={handleEditWidget}
                onDelete={handleDeleteWidget}
              />
            ))}
          </div>
        )}
      </div>

      <AddWidgetModal
        isOpen={showAddWidget}
        onClose={() => {
          setShowAddWidget(false);
          setEditingWidget(null);
        }}
        onSave={handleSaveWidget}
        editingWidget={editingWidget}
      />
    </div>
  );
}
