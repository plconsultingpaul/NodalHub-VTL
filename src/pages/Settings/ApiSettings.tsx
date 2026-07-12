import { useState } from 'react';
import ApiEndpoints from './ApiEndpoints';
import ApiSpecs from './ApiSpecs';

type SubTab = 'endpoints' | 'specs';

export default function ApiSettings() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('endpoints');

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveSubTab('endpoints')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === 'endpoints'
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            API Endpoints
          </button>
          <button
            onClick={() => setActiveSubTab('specs')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === 'specs'
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            API Specs
          </button>
        </nav>
      </div>

      {activeSubTab === 'endpoints' && <ApiEndpoints />}
      {activeSubTab === 'specs' && <ApiSpecs />}
    </div>
  );
}
