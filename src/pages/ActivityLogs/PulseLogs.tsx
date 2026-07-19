import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Trash2,
  Filter,
  Zap,
  ChevronRight,
  ChevronDown,
  Play,
  GitBranch,
  Globe,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import CustomDropdown from '../../components/ui/CustomDropdown';
import DatePicker from '../../components/ui/DatePicker';
import Modal from '../../components/ui/Modal';

interface StepResult {
  nodeId: string;
  name?: string;
  type: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  branch?: string;
  rowCount?: number;
  recipientCount?: number;
  reason?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

interface PulseExecLog {
  id: string;
  pulse_id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'error' | 'partial';
  trigger_source: 'manual' | 'schedule';
  row_count: number;
  error_message: string | null;
  pulse_name: string;
  project_name: string;
  project_color: string;
  email_recipients: string[];
  result_summary: Record<string, unknown> | null;
}

interface PulseOption {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const TRIGGER_BADGE: Record<string, string> = {
  manual: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  schedule: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cell_action: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

const STEP_TYPE_LABELS: Record<string, string> = {
  trigger: 'Trigger',
  query: 'Api Endpoint',
  apiEndpoint: 'Api Endpoint',
  condition: 'Conditional Check',
  email: 'Email',
  action: 'Action',
};

const STEP_ICONS: Record<string, typeof Globe> = {
  trigger: Zap,
  query: Globe,
  apiEndpoint: Globe,
  condition: GitBranch,
  email: Mail,
  action: Zap,
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(start: string, end: string | null) {
  if (!end) return 'Running...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatStepDuration(start?: string, end?: string) {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function StepCard({ step, index }: { step: StepResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const StepIcon = STEP_ICONS[step.type] || Zap;
  const isSuccess = step.status === 'success';
  const isError = step.status === 'error';
  const isSkipped = step.status === 'skipped';

  const borderColor = isSuccess
    ? 'border-emerald-200 dark:border-emerald-800'
    : isError
    ? 'border-red-200 dark:border-red-800'
    : isSkipped
    ? 'border-gray-200 dark:border-gray-700'
    : 'border-blue-200 dark:border-blue-800';

  const bgColor = isSuccess
    ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
    : isError
    ? 'bg-red-50/50 dark:bg-red-900/10'
    : isSkipped
    ? 'bg-gray-50/50 dark:bg-gray-800/50'
    : 'bg-blue-50/50 dark:bg-blue-900/10';

  const numberBg = isSuccess
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : isError
    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : isSkipped
    ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';

  const statusBadge = isSuccess
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : isError
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : isSkipped
    ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';

  const StatusIcon = isSuccess ? CheckCircle2 : isError ? XCircle : isSkipped ? Clock : Clock;

  const hasDetails = step.inputs || step.outputs || step.error;

  return (
    <div className={`border ${borderColor} rounded-lg ${bgColor} overflow-hidden`}>
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${hasDetails ? 'cursor-pointer hover:bg-white/50 dark:hover:bg-gray-800/50' : 'cursor-default'}`}
      >
        {hasDetails && (
          expanded
            ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
        {!hasDetails && <div className="w-4 flex-shrink-0" />}

        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${numberBg}`}>
          <span className="text-xs font-bold">{index + 1}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {step.name || step.nodeId}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <StepIcon className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {STEP_TYPE_LABELS[step.type] || step.type}
            </span>
            {step.startedAt && step.finishedAt && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatStepDuration(step.startedAt, step.finishedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge}`}>
            {isSuccess ? 'Completed' : isError ? 'Error' : isSkipped ? 'Skipped' : 'Running'}
          </span>
          <StatusIcon className={`w-4 h-4 ${isSuccess ? 'text-emerald-500' : isError ? 'text-red-500' : isSkipped ? 'text-gray-400' : 'text-blue-500'}`} />
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-white/60 dark:bg-gray-800/60">
          {step.error && (
            <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-0.5">Error</p>
              <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">{step.error}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {step.inputs && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Inputs</p>
                <div className="space-y-1">
                  {Object.entries(step.inputs).map(([key, val]) => (
                    <div key={key} className="flex gap-2 text-xs">
                      <span className="font-medium text-gray-600 dark:text-gray-300 flex-shrink-0">{key}:</span>
                      <span className="text-gray-500 dark:text-gray-400 break-all font-mono text-[11px]">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step.outputs && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Outputs</p>
                <div className="space-y-1">
                  {Object.entries(step.outputs).map(([key, val]) => (
                    <div key={key} className="flex gap-2 text-xs">
                      <span className="font-medium text-gray-600 dark:text-gray-300 flex-shrink-0">{key}:</span>
                      <span className="text-gray-500 dark:text-gray-400 break-all font-mono text-[11px]">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExecutionDetails({ log }: { log: PulseExecLog }) {
  const summary = log.result_summary;
  const isV2 = summary?.workflow_version === 2;
  const stepResults = (isV2 ? (summary?.step_results as StepResult[]) : null) || [];
  const triggeredBy = (summary?.triggered_by as string) || log.trigger_source;

  return (
    <div className="px-6 py-5 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <Play className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Execution Summary</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Status:</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium ${STATUS_BADGE[log.status] || ''}`}>
                {log.status}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Started:</span>
              <span className="text-gray-700 dark:text-gray-300">{formatTime(log.started_at)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Duration:</span>
              <span className="text-gray-700 dark:text-gray-300">{formatDuration(log.started_at, log.finished_at)}</span>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Processing Details</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Workflow:</span>
              <span className="text-gray-700 dark:text-gray-300">{log.pulse_name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Mode:</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium text-[10px] ${TRIGGER_BADGE[triggeredBy] || TRIGGER_BADGE.manual}`}>
                {triggeredBy === 'cell_action' ? 'Cell Action' : triggeredBy === 'schedule' ? 'Scheduled' : 'Manual'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Version:</span>
              <span className="text-gray-700 dark:text-gray-300">{isV2 ? 'Workflow V2' : 'Legacy V1'}</span>
            </div>
          </div>
        </div>
      </div>

      {isV2 && stepResults.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Workflow Steps Execution
            </h4>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({stepResults.length} {stepResults.length === 1 ? 'step' : 'steps'})
            </span>
          </div>
          <div className="space-y-2">
            {stepResults.map((step, i) => (
              <StepCard key={step.nodeId + i} step={step} index={i} />
            ))}
          </div>
        </div>
      )}

      {!isV2 && log.error_message && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Error Details</p>
          <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">{log.error_message}</p>
        </div>
      )}
    </div>
  );
}

export default function PulseLogs() {
  const { activeCompany, isAdmin } = useAuth();
  const [logs, setLogs] = useState<PulseExecLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pulses, setPulses] = useState<PulseOption[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [filterPulse, setFilterPulse] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTrigger, setFilterTrigger] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>(today);
  const [filterDateTo, setFilterDateTo] = useState<string>(today);

  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeDate, setPurgeDate] = useState<string>(today);

  const fetchPulses = useCallback(async () => {
    if (!activeCompany) return;
    const { data } = await supabase
      .from('pulses')
      .select('id, name')
      .eq('company_id', activeCompany.id)
      .order('name');
    setPulses(data || []);
  }, [activeCompany]);

  const fetchLogs = useCallback(async () => {
    if (!activeCompany) return;

    const { data: companyPulses } = await supabase
      .from('pulses')
      .select('id, name, projects ( name, color )')
      .eq('company_id', activeCompany.id);

    if (!companyPulses || companyPulses.length === 0) {
      setLogs([]);
      return;
    }

    const pulseMap = new Map<string, { name: string; project_name: string; project_color: string }>();
    for (const p of companyPulses) {
      const proj = p.projects as unknown as { name: string; color: string } | null;
      pulseMap.set(p.id, {
        name: p.name,
        project_name: proj?.name || '-',
        project_color: proj?.color || '#9CA3AF',
      });
    }

    let pulseIds = Array.from(pulseMap.keys());
    if (filterPulse) pulseIds = [filterPulse];

    let query = supabase
      .from('pulse_executions')
      .select('*')
      .in('pulse_id', pulseIds)
      .order('started_at', { ascending: false })
      .limit(500);

    if (filterStatus) query = query.eq('status', filterStatus);
    if (filterTrigger) query = query.eq('trigger_source', filterTrigger);
    if (filterDateFrom) query = query.gte('started_at', `${filterDateFrom}T00:00:00`);
    if (filterDateTo) query = query.lte('started_at', `${filterDateTo}T23:59:59`);

    const { data } = await query;

    const rows: PulseExecLog[] = (data || []).map(exec => {
      const info = pulseMap.get(exec.pulse_id) || { name: 'Unknown', project_name: '-', project_color: '#9CA3AF' };
      const resultSummary = exec.result_summary as Record<string, unknown> | null;
      const emailRecipients = (resultSummary?.email_recipients as string[] | undefined) || [];
      return {
        id: exec.id,
        pulse_id: exec.pulse_id,
        started_at: exec.started_at,
        finished_at: exec.finished_at,
        status: exec.status,
        trigger_source: exec.trigger_source,
        row_count: exec.row_count,
        error_message: exec.error_message,
        pulse_name: info.name,
        project_name: info.project_name,
        project_color: info.project_color,
        email_recipients: emailRecipients,
        result_summary: resultSummary,
      };
    });

    setLogs(rows);
  }, [activeCompany, filterPulse, filterStatus, filterTrigger, filterDateFrom, filterDateTo]);

  useEffect(() => {
    if (!activeCompany) return;
    fetchPulses();
  }, [activeCompany, fetchPulses]);

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    fetchLogs().finally(() => setLoading(false));
  }, [activeCompany, fetchLogs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const handlePurge = async () => {
    if (!activeCompany) return;
    setPurging(true);
    const { data: companyPulses } = await supabase
      .from('pulses')
      .select('id')
      .eq('company_id', activeCompany.id);
    if (companyPulses && companyPulses.length > 0) {
      await supabase
        .from('pulse_executions')
        .delete()
        .in('pulse_id', companyPulses.map(p => p.id))
        .lte('started_at', `${purgeDate}T23:59:59`);
    }
    setPurging(false);
    setShowPurgeModal(false);
    fetchLogs();
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Action bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {!loading && `${logs.length} ${logs.length === 1 ? 'execution' : 'executions'}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {isAdmin && (
            <Button variant="secondary" size="sm" onClick={() => setShowPurgeModal(true)} className="text-red-600 hover:text-red-700 dark:text-red-400">
              <Trash2 className="w-4 h-4" />
              Purge
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Pulse</label>
          <CustomDropdown
            value={filterPulse}
            onChange={v => setFilterPulse(v)}
            options={[{ value: '', label: 'All Pulses' }, ...pulses.map(p => ({ value: p.id, label: p.name }))]}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
          <CustomDropdown
            value={filterStatus}
            onChange={v => setFilterStatus(v)}
            options={[
              { value: '', label: 'All' },
              { value: 'success', label: 'Success' },
              { value: 'error', label: 'Error' },
              { value: 'partial', label: 'Partial' },
              { value: 'running', label: 'Running' },
            ]}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Trigger</label>
          <CustomDropdown
            value={filterTrigger}
            onChange={v => setFilterTrigger(v)}
            options={[
              { value: '', label: 'All' },
              { value: 'manual', label: 'Manual' },
              { value: 'schedule', label: 'Scheduled' },
              { value: 'cell_action', label: 'Cell Action' },
            ]}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">From</label>
          <div className="w-40">
            <DatePicker value={filterDateFrom} onChange={v => setFilterDateFrom(v)} placeholder="Start date" size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">To</label>
          <div className="w-40">
            <DatePicker value={filterDateTo} onChange={v => setFilterDateTo(v)} placeholder="End date" size="sm" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
            <Zap className="w-10 h-10 mb-2" />
            <p className="text-sm">No pulse execution logs found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
              <tr>
                <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Time</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Pulse</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Project</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Trigger</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Rows</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Duration</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Emailed</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {logs.map(log => {
                const isExpanded = expandedId === log.id;
                const hasSteps = log.result_summary?.workflow_version === 2 && Array.isArray(log.result_summary?.step_results) && (log.result_summary.step_results as StepResult[]).length > 0;
                return (
                  <tr key={log.id} className="group">
                    <td colSpan={9} className="p-0">
                      <div>
                        <div className={`flex items-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isExpanded ? 'bg-gray-50/50 dark:bg-gray-750/50' : ''}`}>
                          <div className="px-6 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap w-[180px] flex-shrink-0">
                            {formatTime(log.started_at)}
                          </div>
                          <div className="px-4 py-2.5 text-gray-800 dark:text-gray-200 font-medium w-[150px] flex-shrink-0 truncate">
                            {log.pulse_name}
                          </div>
                          <div className="px-4 py-2.5 w-[130px] flex-shrink-0">
                            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: log.project_color }} />
                              <span className="truncate">{log.project_name}</span>
                            </span>
                          </div>
                          <div className="px-4 py-2.5 w-[90px] flex-shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_BADGE[log.status] || 'bg-gray-100 text-gray-700'}`}>
                              {log.status}
                            </span>
                          </div>
                          <div className="px-4 py-2.5 w-[90px] flex-shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${TRIGGER_BADGE[log.trigger_source] || ''}`}>
                              {log.trigger_source}
                            </span>
                          </div>
                          <div className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300 font-mono text-xs w-[60px] flex-shrink-0">
                            {log.row_count.toLocaleString()}
                          </div>
                          <div className="px-4 py-2.5 text-gray-600 dark:text-gray-400 text-xs w-[80px] flex-shrink-0">
                            {formatDuration(log.started_at, log.finished_at)}
                          </div>
                          <div className="px-4 py-2.5 text-xs flex-1 min-w-0">
                            {log.email_recipients.length > 0 ? (
                              <span
                                className="text-blue-600 dark:text-blue-400 truncate block cursor-default"
                                title={log.email_recipients.join(', ')}
                              >
                                {log.email_recipients.join(', ')}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                          <div className="px-4 py-2.5 w-[110px] flex-shrink-0 text-right">
                            {(hasSteps || log.error_message) && (
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                                  isExpanded
                                    ? 'text-red-600 hover:text-red-700 dark:text-red-400'
                                    : 'text-blue-600 hover:text-blue-700 dark:text-blue-400'
                                }`}
                              >
                                {isExpanded ? (
                                  <>
                                    <X className="w-3 h-3" />
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    Show Details
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        {isExpanded && <ExecutionDetails log={log} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Purge Modal */}
      <Modal isOpen={showPurgeModal} onClose={() => setShowPurgeModal(false)} title="Purge Pulse Logs" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will permanently delete all pulse execution logs on or before the selected date.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delete logs on or before</label>
            <DatePicker value={purgeDate} onChange={v => setPurgeDate(v)} placeholder="Select date" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowPurgeModal(false)}>Cancel</Button>
            <Button onClick={handlePurge} loading={purging} className="bg-red-600 hover:bg-red-700 text-white">
              Purge Logs
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
