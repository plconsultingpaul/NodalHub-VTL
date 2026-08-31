import { useState } from 'react';
import ApiEndpoints from './ApiEndpoints';
import ApiSpecs from './ApiSpecs';
import ImagingVendors from './ImagingVendors';

type SubTab = 'endpoints' | 'specs' | 'imaging';

export default function ApiSettings() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('endpoints');

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'endpoints', label: 'API Endpoints' },
    { key: 'specs', label: 'API Specs' },
    { key: 'imaging', label: 'Imaging' },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveSubTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeSubTab === t.key
                  ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {activeSubTab === 'endpoints' && <ApiEndpoints />}
      {activeSubTab === 'specs' && <ApiSpecs />}
      {activeSubTab === 'imaging' && <ImagingVendors />}
    </div>
  );
}
