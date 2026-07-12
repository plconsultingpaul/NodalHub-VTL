import { Activity } from 'lucide-react';

export type PulseTabKey = 'main';

interface PulseTabsProps {
  activeTab: PulseTabKey;
  onChange: (tab: PulseTabKey) => void;
}

const TABS: { key: PulseTabKey; label: string; icon: typeof Activity }[] = [
  { key: 'main', label: 'Main', icon: Activity },
];

export default function PulseTabs({ activeTab, onChange }: PulseTabsProps) {
  return (
    <div className="px-6 pb-3">
      <div className="bg-slate-100 dark:bg-gray-800 p-1 rounded-lg inline-flex items-center gap-1 overflow-x-auto no-scrollbar">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={
                isActive
                  ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-gray-600 px-4 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap flex items-center gap-2'
                  : 'text-sm font-medium text-slate-500 dark:text-slate-400 px-4 py-1.5 rounded-md transition-all whitespace-nowrap hover:bg-slate-200/70 dark:hover:bg-gray-700/70 hover:text-slate-900 dark:hover:text-white flex items-center gap-2'
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
