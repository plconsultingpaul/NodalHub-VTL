import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Building2, Users, Server, Palette, Mail, Settings as SettingsIcon, Clock, AppWindow, FunctionSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../../components/ui/PageHeader';

const navItems = [
  { to: '/settings', icon: Building2, label: 'Company', id: 'company', end: true, adminOnly: false },
  { to: '/settings/members', icon: Users, label: 'Team Members', id: 'members', adminOnly: true },
  { to: '/settings/api', icon: Server, label: 'API Settings', id: 'api', adminOnly: false },
  { to: '/settings/functions', icon: FunctionSquare, label: 'Functions', id: 'functions', adminOnly: true },
  { to: '/settings/email', icon: Mail, label: 'Email', id: 'email', adminOnly: true },
  { to: '/settings/schedule', icon: Clock, label: 'Schedule Manager', id: 'schedule', adminOnly: true },
  { to: '/settings/branding', icon: Palette, label: 'Branding', id: 'branding', adminOnly: true },
  { to: '/settings/applications', icon: AppWindow, label: 'Applications', id: 'applications', adminOnly: true },
];

export default function SettingsLayout() {
  const { activeCompany, isAdmin, hasPermission } = useAuth();
  const location = useLocation();

  const isActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  const visibleItems = navItems.filter(item => {
    if (isAdmin) return true;
    if (item.adminOnly) return hasPermission('settings_tab', item.id);
    return true;
  });

  return (
    <div className="min-h-full bg-slate-50 dark:bg-gray-900">
      <div className="px-8 pt-8 pb-0">
        <PageHeader
          icon={SettingsIcon}
          title="Settings"
          subtitle="Manage your company settings and preferences"
          tabs={
            <div className="bg-slate-100 dark:bg-gray-800 p-1 rounded-lg inline-flex items-center gap-1 overflow-x-auto no-scrollbar">
              {visibleItems.map((item) => {
                const active = isActive(item.to, item.end);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={
                      active
                        ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-gray-600 px-4 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap flex items-center gap-2'
                        : 'text-sm font-medium text-slate-500 dark:text-slate-400 px-4 py-1.5 rounded-md transition-all whitespace-nowrap hover:bg-slate-200/70 dark:hover:bg-gray-700/70 hover:text-slate-900 dark:hover:text-white flex items-center gap-2'
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          }
        />
      </div>

      <div className="px-8 pb-8 pt-6">
        <Outlet />
      </div>
    </div>
  );
}
