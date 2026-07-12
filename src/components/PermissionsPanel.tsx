import { useState, useEffect } from 'react';
import { LayoutDashboard, Activity, Settings, Check, Pencil, Save, Palette, ScrollText, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { PermissionType } from '../contexts/AuthContext';

export interface PermissionEntry {
  permission_type: PermissionType;
  resource_id: string | null;
  access_level: 'view' | 'edit' | 'access';
}

interface DashboardItem {
  id: string;
  name: string;
  project_name: string;
}

interface SsoAppItem {
  id: string;
  name: string;
  icon_url: string | null;
}

const SETTINGS_TABS = [
  { id: 'company', label: 'Company' },
  { id: 'members', label: 'Team Members' },
  { id: 'api', label: 'API Settings' },
  { id: 'queries', label: 'Query Manager' },
  { id: 'email', label: 'Email' },
  { id: 'schedule', label: 'Schedule Manager' },
  { id: 'branding', label: 'Branding' },
];

type Category = 'dashboards' | 'pulse' | 'settings' | 'logs' | 'applications';

interface Props {
  companyId: string;
  permissions: PermissionEntry[];
  onChange: (permissions: PermissionEntry[]) => void;
}

function PermissionsPanel({ companyId, permissions, onChange }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('dashboards');
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [ssoApps, setSsoApps] = useState<SsoAppItem[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const fetchDashboards = async () => {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('type', 'dashboards');

      if (!projects) return;

      const { data: dashes } = await supabase
        .from('dashboards')
        .select('id, name, project_id')
        .eq('company_id', companyId);

      if (dashes) {
        setDashboards(dashes.map(d => ({
          id: d.id,
          name: d.name,
          project_name: projects.find(p => p.id === d.project_id)?.name || '',
        })));
      }
    };
    const fetchSsoApps = async () => {
      const { data } = await supabase
        .from('sso_applications')
        .select('id, name, icon_url')
        .eq('company_id', companyId)
        .order('sort_order');
      setSsoApps(data || []);
    };
    fetchDashboards();
    fetchSsoApps();
  }, [companyId]);

  const hasPulseAccess = permissions.some(p => p.permission_type === 'pulse');
  const hasDashboardEdit = permissions.some(p => p.permission_type === 'dashboard_edit');
  const hasSaveTemplates = permissions.some(p => p.permission_type === 'save_templates');
  const hasEditGridLayout = permissions.some(p => p.permission_type === 'edit_grid_layout');
  const hasViewLogs = permissions.some(p => p.permission_type === 'view_logs');

  const hasDashboardView = (dashId: string) => {
    return permissions.some(p => p.permission_type === 'dashboard' && p.resource_id === dashId);
  };

  const hasSettingsPerm = (tabId: string) => {
    return permissions.some(p => p.permission_type === 'settings_tab' && p.resource_id === tabId);
  };

  const hasSsoAppAccess = (appId: string) => {
    return permissions.some(p => p.permission_type === 'sso_application' && p.resource_id === appId);
  };

  const toggleSsoApp = (appId: string) => {
    let next: PermissionEntry[];
    if (hasSsoAppAccess(appId)) {
      next = permissions.filter(p => !(p.permission_type === 'sso_application' && p.resource_id === appId));
    } else {
      next = [...permissions, { permission_type: 'sso_application', resource_id: appId, access_level: 'access' }];
    }
    onChange(next);
  };

  const selectAllSsoApps = () => {
    const next = permissions.filter(p => p.permission_type !== 'sso_application');
    ssoApps.forEach(app => {
      next.push({ permission_type: 'sso_application', resource_id: app.id, access_level: 'access' });
    });
    onChange(next);
  };

  const clearAllSsoApps = () => {
    onChange(permissions.filter(p => p.permission_type !== 'sso_application'));
  };

  const toggleDashboardView = (dashId: string) => {
    let next: PermissionEntry[];
    if (hasDashboardView(dashId)) {
      next = permissions.filter(p => !(p.permission_type === 'dashboard' && p.resource_id === dashId));
    } else {
      next = [...permissions, { permission_type: 'dashboard', resource_id: dashId, access_level: 'view' }];
    }
    onChange(next);
  };

  const toggleDashboardEdit = () => {
    let next: PermissionEntry[];
    if (hasDashboardEdit) {
      next = permissions.filter(p => p.permission_type !== 'dashboard_edit');
    } else {
      next = [...permissions, { permission_type: 'dashboard_edit', resource_id: null, access_level: 'access' }];
    }
    onChange(next);
  };

  const toggleSaveTemplates = () => {
    let next: PermissionEntry[];
    if (hasSaveTemplates) {
      next = permissions.filter(p => p.permission_type !== 'save_templates');
    } else {
      next = [...permissions, { permission_type: 'save_templates', resource_id: null, access_level: 'access' }];
    }
    onChange(next);
  };

  const toggleEditGridLayout = () => {
    let next: PermissionEntry[];
    if (hasEditGridLayout) {
      next = permissions.filter(p => p.permission_type !== 'edit_grid_layout');
    } else {
      next = [...permissions, { permission_type: 'edit_grid_layout', resource_id: null, access_level: 'access' }];
    }
    onChange(next);
  };

  const toggleViewLogs = () => {
    let next: PermissionEntry[];
    if (hasViewLogs) {
      next = permissions.filter(p => p.permission_type !== 'view_logs');
    } else {
      next = [...permissions, { permission_type: 'view_logs', resource_id: null, access_level: 'access' }];
    }
    onChange(next);
  };

  const togglePulse = () => {
    let next: PermissionEntry[];
    if (hasPulseAccess) {
      next = permissions.filter(p => p.permission_type !== 'pulse');
    } else {
      next = [...permissions, { permission_type: 'pulse', resource_id: null, access_level: 'access' }];
    }
    onChange(next);
  };

  const toggleSettingsTab = (tabId: string) => {
    let next: PermissionEntry[];
    if (hasSettingsPerm(tabId)) {
      next = permissions.filter(p => !(p.permission_type === 'settings_tab' && p.resource_id === tabId));
    } else {
      next = [...permissions, { permission_type: 'settings_tab', resource_id: tabId, access_level: 'access' }];
    }
    onChange(next);
  };

  const selectAllDashboards = () => {
    const next = permissions.filter(p => p.permission_type !== 'dashboard');
    dashboards.forEach(d => {
      next.push({ permission_type: 'dashboard', resource_id: d.id, access_level: 'view' });
    });
    onChange(next);
  };

  const clearAllDashboards = () => {
    onChange(permissions.filter(p => p.permission_type !== 'dashboard'));
  };

  const selectAllSettings = () => {
    const next = permissions.filter(p => p.permission_type !== 'settings_tab');
    SETTINGS_TABS.forEach(t => {
      next.push({ permission_type: 'settings_tab', resource_id: t.id, access_level: 'access' });
    });
    onChange(next);
  };

  const clearAllSettings = () => {
    onChange(permissions.filter(p => p.permission_type !== 'settings_tab'));
  };

  const dashboardCount = permissions.filter(p => p.permission_type === 'dashboard').length;
  const settingsCount = permissions.filter(p => p.permission_type === 'settings_tab').length;
  const ssoAppCount = permissions.filter(p => p.permission_type === 'sso_application').length;

  const categories: { key: Category; icon: typeof LayoutDashboard; label: string; count: string }[] = [
    { key: 'dashboards', icon: LayoutDashboard, label: 'Dashboards', count: `${dashboardCount}/${dashboards.length}` },
    { key: 'pulse', icon: Activity, label: 'Pulse', count: hasPulseAccess ? '1/1' : '0/1' },
    { key: 'settings', icon: Settings, label: 'Settings', count: `${settingsCount}/${SETTINGS_TABS.length}` },
    { key: 'applications', icon: ExternalLink, label: 'Applications', count: `${ssoAppCount}/${ssoApps.length}` },
    { key: 'logs', icon: ScrollText, label: 'Logs', count: hasViewLogs ? '1/1' : '0/1' },
  ];

  return (
    <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden min-h-[340px]">
      {/* Left sidebar */}
      <div className="w-48 border-r border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
              activeCategory === cat.key
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-l-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border-l-2 border-transparent'
            }`}
          >
            <cat.icon className="w-4 h-4" />
            <span className="font-medium flex-1 text-left">{cat.label}</span>
            <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {activeCategory === 'dashboards' && (
          <div>
            {/* Edit toggle */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={toggleDashboardEdit}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                  hasDashboardEdit
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Pencil className={`w-4 h-4 flex-shrink-0 ${hasDashboardEdit ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <span className={`text-sm font-medium block leading-tight ${hasDashboardEdit ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Add & Edit Dashboards
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">Create and edit dashboards</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2 ${
                  hasDashboardEdit ? 'bg-blue-600' : 'border-2 border-gray-300 dark:border-gray-500'
                }`}>
                  {hasDashboardEdit && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>

              <button
                onClick={toggleSaveTemplates}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                  hasSaveTemplates
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Save className={`w-4 h-4 flex-shrink-0 ${hasSaveTemplates ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <span className={`text-sm font-medium block leading-tight ${hasSaveTemplates ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Save Templates
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">Save and manage grid templates</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2 ${
                  hasSaveTemplates ? 'bg-blue-600' : 'border-2 border-gray-300 dark:border-gray-500'
                }`}>
                  {hasSaveTemplates && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>

              <button
                onClick={toggleEditGridLayout}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                  hasEditGridLayout
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Palette className={`w-4 h-4 flex-shrink-0 ${hasEditGridLayout ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <span className={`text-sm font-medium block leading-tight ${hasEditGridLayout ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Edit Grid Layout
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">Grid formatting and columns</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2 ${
                  hasEditGridLayout ? 'bg-blue-600' : 'border-2 border-gray-300 dark:border-gray-500'
                }`}>
                  {hasEditGridLayout && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            </div>

            {/* Dashboard visibility list */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Visible Dashboards</span>
              <div className="flex gap-2">
                <button onClick={selectAllDashboards} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">All</button>
                <button onClick={clearAllDashboards} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">None</button>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {dashboards.map(dash => {
                const hasAccess = hasDashboardView(dash.id);
                return (
                  <button
                    key={dash.id}
                    onClick={() => toggleDashboardView(dash.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors ${
                      hasAccess ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <LayoutDashboard className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 text-left">
                        <span className={`text-sm block truncate ${hasAccess ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                          {dash.name}
                        </span>
                        {dash.project_name && (
                          <span className="text-xs text-gray-400">{dash.project_name}</span>
                        )}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      hasAccess ? 'bg-blue-600' : 'border-2 border-gray-300 dark:border-gray-500'
                    }`}>
                      {hasAccess && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
              {dashboards.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">No dashboards in this company yet.</p>
              )}
            </div>
          </div>
        )}

        {activeCategory === 'pulse' && (
          <div>
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Pulse Access</span>
            </div>
            <div className="p-4">
              <button
                onClick={togglePulse}
                className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  hasPulseAccess
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Activity className={`w-5 h-5 ${hasPulseAccess ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <span className={`text-sm font-medium block ${hasPulseAccess ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Pulse
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Access to create and manage Pulses</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  hasPulseAccess ? 'bg-blue-600' : 'border-2 border-gray-300 dark:border-gray-500'
                }`}>
                  {hasPulseAccess && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            </div>
          </div>
        )}

        {activeCategory === 'settings' && (
          <div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Settings Tabs</span>
              <div className="flex gap-2">
                <button onClick={selectAllSettings} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">All</button>
                <button onClick={clearAllSettings} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">None</button>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {SETTINGS_TABS.map(tab => {
                const hasAccess = hasSettingsPerm(tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => toggleSettingsTab(tab.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                      hasAccess ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-gray-400" />
                      <span className={`text-sm ${hasAccess ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                        {tab.label}
                      </span>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      hasAccess ? 'bg-blue-600' : 'border-2 border-gray-300 dark:border-gray-500'
                    }`}>
                      {hasAccess && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeCategory === 'applications' && (
          <div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Quick Switch Applications</span>
              <div className="flex gap-2">
                <button onClick={selectAllSsoApps} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">All</button>
                <button onClick={clearAllSsoApps} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">None</button>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {ssoApps.map(app => {
                const hasAccess = hasSsoAppAccess(app.id);
                return (
                  <button
                    key={app.id}
                    onClick={() => toggleSsoApp(app.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors ${
                      hasAccess ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {app.icon_url ? (
                        <img src={app.icon_url} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0" />
                      ) : (
                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={`text-sm truncate ${hasAccess ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                        {app.name}
                      </span>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      hasAccess ? 'bg-blue-600' : 'border-2 border-gray-300 dark:border-gray-500'
                    }`}>
                      {hasAccess && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
              {ssoApps.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">No applications configured for this company.</p>
              )}
            </div>
          </div>
        )}

        {activeCategory === 'logs' && (
          <div>
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Activity Logs Access</span>
            </div>
            <div className="p-4">
              <button
                onClick={toggleViewLogs}
                className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  hasViewLogs
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ScrollText className={`w-5 h-5 ${hasViewLogs ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <span className={`text-sm font-medium block ${hasViewLogs ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      View Activity Logs
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Access to view user activity logs</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  hasViewLogs ? 'bg-blue-600' : 'border-2 border-gray-300 dark:border-gray-500'
                }`}>
                  {hasViewLogs && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PermissionsPanel