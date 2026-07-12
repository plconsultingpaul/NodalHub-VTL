import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Power,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { computeNextCronRun } from '../../lib/cronNext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import Modal from '../../components/ui/Modal';

type SchedulerStatus = {
  enabled: boolean;
  job_exists: boolean;
  schedule: string;
  status: 'running' | 'stopped' | 'misconfigured' | 'error';
  active_pulses_count: number;
  last_pulse_run: string | null;
  connection_configured: boolean;
};

type PulseScheduleRow = {
  id: string;
  name: string;
  is_active: boolean;
  project_name: string;
  project_color: string;
  cron_expression: string;
  schedule_enabled: boolean;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
};

const FREQUENCY_OPTIONS = [
  { label: 'Every minute', cron: '* * * * *' },
  { label: 'Every 2 minutes', cron: '*/2 * * * *' },
  { label: 'Every 5 minutes', cron: '*/5 * * * *' },
  { label: 'Every 10 minutes', cron: '*/10 * * * *' },
  { label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { label: 'Every 30 minutes', cron: '*/30 * * * *' },
  { label: 'Every hour', cron: '0 * * * *' },
];

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    running: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    stopped: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    misconfigured: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    running_pulse: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return map[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

const cronManagerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cron-manager`;
const pulseRunnerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pulse-runner`;

export default function ScheduleManager() {
  const { activeCompany } = useAuth();
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [pulseRows, setPulseRows] = useState<PulseScheduleRow[]>([]);
  const [loadingPulses, setLoadingPulses] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCronModal, setShowCronModal] = useState<{ pulseId: string; cron: string; timezone: string } | null>(null);
  const [selectedFrequency, setSelectedFrequency] = useState('*/5 * * * *');

  const isAdmin = activeCompany?.role === 'Admin';

  const callCronManager = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`${cronManagerUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init.headers || {}),
        },
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (!res.ok) {
        throw new Error(
          (data && typeof data === 'object' && 'error' in data
            ? String((data as { error?: string }).error)
            : null) || `Request failed (${res.status})`
        );
      }
      return data;
    },
    []
  );

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = (await callCronManager('/status')) as SchedulerStatus;
      setStatus(data);
      if (data?.schedule) setSelectedFrequency(data.schedule);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduler status');
    } finally {
      setLoadingStatus(false);
    }
  }, [callCronManager]);

  const fetchPulses = useCallback(async () => {
    if (!activeCompany) return;
    setLoadingPulses(true);
    try {
      const { data, error: pulseErr } = await supabase
        .from('pulses')
        .select(`
          id, name, is_active, last_run_at, last_run_status,
          projects ( name, color ),
          pulse_schedules ( cron_expression, enabled, next_run_at, timezone )
        `)
        .eq('company_id', activeCompany.id)
        .order('name');
      if (pulseErr) throw pulseErr;

      const rows: PulseScheduleRow[] = (data || []).map((p) => {
        const project = (p.projects as unknown as { name: string; color: string } | null) || {
          name: '—',
          color: '#9CA3AF',
        };
        const sched = (p.pulse_schedules as unknown as
          | { cron_expression: string; enabled: boolean; next_run_at: string | null; timezone: string | null }
          | null) || { cron_expression: '0 * * * *', enabled: false, next_run_at: null, timezone: 'UTC' };
        return {
          id: p.id,
          name: p.name,
          is_active: p.is_active,
          project_name: project.name,
          project_color: project.color,
          cron_expression: sched.cron_expression,
          schedule_enabled: sched.enabled,
          timezone: sched.timezone || 'UTC',
          next_run_at: sched.next_run_at,
          last_run_at: p.last_run_at,
          last_run_status: p.last_run_status,
        };
      });
      setPulseRows(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pulses');
    } finally {
      setLoadingPulses(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchStatus();
    fetchPulses();
  }, [isAdmin, fetchStatus, fetchPulses]);

  const flashInfo = (msg: string) => {
    setInfo(msg);
    setTimeout(() => setInfo(null), 3000);
  };

  const handleEnable = async () => {
    setBusyAction('enable');
    setError(null);
    try {
      await callCronManager('/enable', {
        method: 'POST',
        body: JSON.stringify({ schedule: selectedFrequency }),
      });
      await fetchStatus();
      flashInfo('Scheduler enabled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable scheduler');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisable = async () => {
    setBusyAction('disable');
    setError(null);
    try {
      await callCronManager('/disable', { method: 'POST' });
      await fetchStatus();
      flashInfo('Scheduler stopped');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable scheduler');
    } finally {
      setBusyAction(null);
    }
  };

  const handleTogglePulseSchedule = async (row: PulseScheduleRow) => {
    setBusyAction(`toggle-${row.id}`);
    setError(null);
    try {
      const enabling = !row.schedule_enabled;
      const payload: Record<string, unknown> = {
        pulse_id: row.id,
        enabled: enabling,
        cron_expression: row.cron_expression,
        updated_at: new Date().toISOString(),
      };
      if (enabling) {
        payload.next_run_at = computeNextCronRun(row.cron_expression, row.timezone);
      } else {
        payload.next_run_at = null;
      }
      const { error: upsertError } = await supabase.from('pulse_schedules').upsert(
        payload,
        { onConflict: 'pulse_id' }
      );
      if (upsertError) throw upsertError;
      await fetchPulses();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveCron = async () => {
    if (!showCronModal) return;
    setBusyAction(`cron-${showCronModal.pulseId}`);
    setError(null);
    try {
      const nextRunAt = computeNextCronRun(showCronModal.cron, showCronModal.timezone);
      const { error: upsertError } = await supabase.from('pulse_schedules').upsert(
        {
          pulse_id: showCronModal.pulseId,
          cron_expression: showCronModal.cron,
          next_run_at: nextRunAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'pulse_id' }
      );
      if (upsertError) throw upsertError;
      setShowCronModal(null);
      await fetchPulses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update cron');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunNow = async (pulseId: string) => {
    setBusyAction(`run-${pulseId}`);
    setError(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(pulseRunnerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pulseId, triggerSource: 'manual' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `Run failed (${res.status})`);
      }
      flashInfo(`Pulse executed (${data.status}, ${data.rowCount ?? 0} rows)`);
      await fetchPulses();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run pulse');
    } finally {
      setBusyAction(null);
    }
  };

  const statusLabel = useMemo(() => {
    if (!status) return 'Loading…';
    if (status.status === 'running') return 'Active';
    if (status.status === 'misconfigured') return 'Misconfigured';
    if (status.status === 'error') return 'Error';
    return 'Stopped';
  }, [status]);

  const statusIcon = useMemo(() => {
    if (!status) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (status.status === 'running') return <CheckCircle2 className="w-4 h-4" />;
    if (status.status === 'misconfigured') return <AlertCircle className="w-4 h-4" />;
    if (status.status === 'error') return <XCircle className="w-4 h-4" />;
    return <Power className="w-4 h-4" />;
  }, [status]);

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admins only</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          You need admin access to view the Schedule Manager.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-700 dark:text-red-300 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {info && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{info}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Activity className="w-6 h-6 text-gray-700 dark:text-gray-200" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scheduler</h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                    status?.status || 'stopped'
                  )}`}
                >
                  {statusIcon}
                  {statusLabel}
                </span>
                {status && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {status.active_pulses_count} active pulse{status.active_pulses_count === 1 ? '' : 's'}
                  </span>
                )}
                {status?.last_pulse_run && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    · Last run {formatDate(status.last_pulse_run)}
                  </span>
                )}
              </div>
              {status && !status.connection_configured && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Connection settings are not configured. Enabling will fail until they are set.
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Scheduler runs in UTC. Per-pulse timezone is applied when computing next run times for time-of-day schedules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <CustomDropdown
              value={selectedFrequency}
              onChange={(val) => setSelectedFrequency(val)}
              options={FREQUENCY_OPTIONS.map((opt) => ({ value: opt.cron, label: opt.label }))}
              size="sm"
            />
            <Button variant="secondary" onClick={() => setShowSettingsModal(true)}>
              <SettingsIcon className="w-4 h-4" />
              Connection Settings
            </Button>
            <Button variant="secondary" onClick={fetchStatus} disabled={loadingStatus}>
              <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {status?.status === 'running' ? (
              <Button variant="danger" onClick={handleDisable} loading={busyAction === 'disable'}>
                <Power className="w-4 h-4" />
                Stop Scheduler
              </Button>
            ) : (
              <Button onClick={handleEnable} loading={busyAction === 'enable'}>
                <Power className="w-4 h-4" />
                Start Scheduler
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Pulses</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Toggle scheduling and run any pulse manually.
            </p>
          </div>
        </div>
        {loadingPulses ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : pulseRows.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No pulses yet for this company.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left px-6 py-3">Pulse</th>
                  <th className="text-left px-6 py-3">Project</th>
                  <th className="text-left px-6 py-3">Active</th>
                  <th className="text-left px-6 py-3">Cron</th>
                  <th className="text-left px-6 py-3">Next Run</th>
                  <th className="text-left px-6 py-3">Last Run</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {pulseRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{row.name}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: row.project_color }}
                        />
                        {row.project_name}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          row.is_active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {row.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {row.cron_expression}
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300">
                      {row.schedule_enabled ? formatDate(row.next_run_at) : '—'}
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300">
                      {formatDate(row.last_run_at)}
                    </td>
                    <td className="px-6 py-3">
                      {row.last_run_status ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(row.last_run_status)}`}
                        >
                          {row.last_run_status}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRunNow(row.id)}
                          disabled={busyAction === `run-${row.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                          title="Run Now"
                        >
                          {busyAction === `run-${row.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          Run
                        </button>
                        <button
                          onClick={() =>
                            setShowCronModal({ pulseId: row.id, cron: row.cron_expression, timezone: row.timezone })
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Edit cron"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Cron
                        </button>
                        <button
                          onClick={() => handleTogglePulseSchedule(row)}
                          disabled={busyAction === `toggle-${row.id}`}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium disabled:opacity-50 ${
                            row.schedule_enabled
                              ? 'text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                              : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {row.schedule_enabled ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConnectionSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        callCronManager={callCronManager}
        onSaved={fetchStatus}
      />

      <Modal
        isOpen={!!showCronModal}
        onClose={() => setShowCronModal(null)}
        title="Edit Cron Expression"
      >
        {showCronModal && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cron expression
              </label>
              <input
                type="text"
                value={showCronModal.cron}
                onChange={(e) => setShowCronModal({ ...showCronModal, cron: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="0 * * * *"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Standard 5-field cron: minute, hour, day, month, day-of-week.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.cron}
                  type="button"
                  onClick={() => setShowCronModal({ ...showCronModal, cron: opt.cron })}
                  className="px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowCronModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveCron}
                loading={busyAction === `cron-${showCronModal.pulseId}`}
              >
                <Save className="w-4 h-4" />
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

interface ConnectionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  callCronManager: (path: string, init?: RequestInit) => Promise<unknown>;
  onSaved: () => void;
}

function ConnectionSettingsModal({
  isOpen,
  onClose,
  callCronManager,
  onSaved,
}: ConnectionSettingsModalProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [anonKeyConfigured, setAnonKeyConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setTestResult(null);
      try {
        const data = (await callCronManager('/settings')) as {
          supabase_url: string;
          anon_key_configured: boolean;
        };
        if (cancelled) return;
        setSupabaseUrl(data.supabase_url || '');
        setAnonKeyConfigured(!!data.anon_key_configured);
        setAnonKey('');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, callCronManager]);

  const handleSave = async () => {
    if (!supabaseUrl.trim() || !anonKey.trim()) {
      setError('Both fields are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await callCronManager('/settings', {
        method: 'POST',
        body: JSON.stringify({ supabase_url: supabaseUrl.trim(), anon_key: anonKey.trim() }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = (await callCronManager('/test-connection', { method: 'POST' })) as {
        success: boolean;
        status?: number;
        error?: string;
      };
      setTestResult({
        success: !!data.success,
        message: data.success
          ? `Connection OK${data.status ? ` (HTTP ${data.status})` : ''}`
          : data.error || 'Connection failed',
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scheduler Connection Settings">
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            The cron job runs inside Postgres and uses these credentials to call the
            <span className="font-mono"> /pulse-scheduler </span> edge function.
          </p>
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Supabase URL
            </label>
            <input
              type="url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Anon Key
            </label>
            <input
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder={anonKeyConfigured ? '•••••••••• (already configured)' : 'eyJhbGci...'}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm"
            />
            {anonKeyConfigured && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave blank to keep existing key. Enter a new value to replace it.
              </p>
            )}
          </div>
          {testResult && (
            <div
              className={`p-3 rounded-lg flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              )}
              <p
                className={`text-sm ${
                  testResult.success
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-700 dark:text-red-300'
                }`}
              >
                {testResult.message}
              </p>
            </div>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={handleTest} loading={testing}>
              Test Connection
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving}>
                <Save className="w-4 h-4" />
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
