import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ScrollText, Zap } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';

const navItems = [
  { to: '/logs', icon: LayoutDashboard, label: 'Dashboard Logs', end: true },
  { to: '/logs/pulse', icon: Zap, label: 'Pulse Logs', end: false },
];

export default function ActivityLogsLayout() {
  const location = useLocation();

  const isActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  return (
    <div className="min-h-full bg-slate-50 dark:bg-gray-900">
      <div className="px-8 pt-8 pb-0">
        <PageHeader
          icon={ScrollText}
          title="Activity Logs"
          subtitle="Monitor dashboard activity and pulse execution history"
          tabs={
            <div className="bg-slate-100 dark:bg-gray-800 p-1 rounded-lg inline-flex items-center gap-1 overflow-x-auto no-scrollbar">
              {navItems.map((item) => {
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

      <div className="px-8 pb-8">
        <Outlet />
      </div>
    </div>
  );
}
