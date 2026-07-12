import type { PulseExport, PulseExportFormat } from '../../types/database';

interface ExportTabProps {
  draft: Partial<PulseExport>;
  onChange: (updates: Partial<PulseExport>) => void;
  pulseName: string;
}

const TOKEN_HINTS = [
  { token: '{pulse_name}', description: 'The pulse name' },
  { token: '{date}', description: 'The run date in YYYY-MM-DD' },
  { token: '{group}', description: 'Active group value (Per Group mode only)' },
];

const resolveFilenamePreview = (template: string, pulseName: string) => {
  const today = new Date().toISOString().slice(0, 10);
  const base = (template || '{pulse_name}_{date}')
    .replace(/\{pulse_name\}/g, pulseName || 'pulse')
    .replace(/\{date\}/g, today)
    .replace(/\{group\}/g, 'group-1');
  return base.endsWith('.csv') || base.endsWith('.xlsx') ? base : base;
};

export default function ExportTab({ draft, onChange, pulseName }: ExportTabProps) {
  const enabled = draft.enabled ?? false;
  const format = (draft.format || 'csv') as PulseExportFormat;
  const filenameTemplate = draft.filename_template || '{pulse_name}_{date}';
  const includeHeaders = draft.include_headers ?? true;
  const preview = `${resolveFilenamePreview(filenameTemplate, pulseName)}.${format}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Enable export</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Generate a file with the query results on every run.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ enabled: !enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Format</label>
            <div className="flex gap-2">
              {(['csv', 'xlsx'] as PulseExportFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onChange({ format: f })}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    format === f
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filename template
            </label>
            <input
              type="text"
              value={filenameTemplate}
              onChange={(e) => onChange({ filename_template: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent font-mono text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {TOKEN_HINTS.map((t) => (
                <span
                  key={t.token}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                  title={t.description}
                >
                  <code className="font-mono">{t.token}</code>
                  <span className="text-gray-500 dark:text-gray-400">— {t.description}</span>
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Preview: <span className="font-mono text-gray-900 dark:text-gray-100">{preview}</span>
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Include column headers</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Adds a header row with the field names.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ include_headers: !includeHeaders })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                includeHeaders ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  includeHeaders ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
