import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export default function PageHeader({ icon: Icon, title, subtitle, actions, tabs }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-slate-900 rounded-xl shadow-sm text-white shrink-0">
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {tabs}
    </div>
  );
}
