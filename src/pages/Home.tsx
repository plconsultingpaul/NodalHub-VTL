import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../hooks/useProjects';
import { usePulses } from '../hooks/usePulses';
import { useActiveDashboards } from '../contexts/ActiveDashboardsContext';
import { LayoutDashboard, FolderKanban, Activity, Plus, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import DashboardBuilder from './DashboardBuilder';
import DashboardViewer from './DashboardViewer';
import PulseBuilder from './PulseBuilder';

export default function Home() {
  const { profile, activeCompany } = useAuth();
  const { projects, loading } = useProjects();
  const { pulses, loading: pulsesLoading } = usePulses();
  const { isBuilderOpen, isPulseBuilderOpen, activeDashboardId, openDashboard } = useActiveDashboards();

  if (isBuilderOpen) {
    return <DashboardBuilder />;
  }

  if (isPulseBuilderOpen) {
    return <PulseBuilder />;
  }

  if (activeDashboardId) {
    return <DashboardViewer />;
  }

  const totalDashboards = projects.reduce((sum, p) => sum + p.dashboards.length, 0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleDashboardClick = (dashboard: { id: string; name: string; project_id: string; company_id: string; created_by: string | null; created_at: string; updated_at: string }) => {
    openDashboard(dashboard);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Here's what's happening with {activeCompany?.name || 'your company'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Projects</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {loading ? '...' : projects.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Dashboards</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {loading ? '...' : totalDashboards}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pulses</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {pulsesLoading ? '...' : pulses.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Dashboards</h2>
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderKanban className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No projects yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                Get started by creating your first project to organize your dashboards.
              </p>
              <Button>
                <Plus className="w-4 h-4" />
                Create Your First Project
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {projects.flatMap(project =>
                project.dashboards.map(dashboard => ({
                  ...dashboard,
                  projectName: project.name,
                  projectColor: project.color
                }))
              ).slice(0, 5).map((dashboard) => (
                <button
                  key={dashboard.id}
                  onClick={() => handleDashboardClick(dashboard)}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group w-full text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <LayoutDashboard className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{dashboard.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: dashboard.projectColor }}
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-400">{dashboard.projectName}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </button>
              ))}
              {totalDashboards === 0 && (
                <div className="p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">No dashboards created yet. Create a dashboard inside a project to get started.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
