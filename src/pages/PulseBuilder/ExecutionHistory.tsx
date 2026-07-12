import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Globe,
  Mail,
  Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import type { PulseExecution } from '../../types/database';

interface StepResult {
  nodeId: string;
  type: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  branch?: string;
  rowCount?: number;
  recipientCount?: number;
  reason?: string;
}

interface ExecutionHistoryProps {
  pulseId: string;
  pulseName: string;
  onBack: () => void;
  onRerun: () => void;
  running?: boolean;
}

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Success' },
  error: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Error' },
  partial: { icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Partial' },
  running: { icon: Loader2, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'Running' },
};

const STEP_ICONS: Record<string, typeof Globe> = {
  trigger: Zap,
  query: Globe,
  condition: GitBranch,
  email: Mail,
};

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'In progress';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ExecutionRow({ execution, onRerun, running }: { execution: PulseExecution; onRerun: () => void; running?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[execution.status] || STATUS_CONFIG.error;
  const StatusIcon = config.icon;

  const summary = execution.result_summary as Record<string, unknown> | null;
  const isV2 = summary?.workflow_version === 2;
  const stepResults = (isV2 ? (summary?.step_results as StepResult[]) : null) || [];
  const v1Summary = !isV2 ? summary : null;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${config.color} ${execution.status === 'running' ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {execution.trigger_source === 'schedule' ? 'Scheduled' : 'Manual'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {formatTime(execution.started_at)}
            {execution.finished_at && (
              <span className="ml-2 text-gray-400 dark:text-gray-500">
                ({formatDuration(execution.started_at, execution.finished_at)})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {execution.row_count > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded font-medium">
              {execution.row_count} rows
            </span>
          )}
          {execution.status === 'error' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onRerun(); }}
              loading={running}
              disabled={running}
            >
              <RotateCcw className="w-3 h-3" />
              Re-run
            </Button>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 px-4 py-3">
          {execution.error_message && (
            <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-[11px] font-semibold text-red-700 dark:text-red-300 mb-0.5">Error</p>
              <p className="text-[11px] text-red-600 dark:text-red-400 font-mono break-all">
                {execution.error_message}
              </p>
            </div>
          )}

          {isV2 && stepResults.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Step Execution
              </p>
              {stepResults.map((step, i) => {
                const StepIcon = STEP_ICONS[step.type] || Zap;
                const stepStatus = step.status === 'success' ? STATUS_CONFIG.success
                  : step.status === 'error' ? STATUS_CONFIG.error
                  : step.status === 'skipped' ? { icon: Clock, color: 'text-gray-400 dark:text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700', label: 'Skipped' }
                  : STATUS_CONFIG.running;
                return (
                  <div key={i} className="flex items-start gap-2.5 py-1.5">
                    <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                      <StepIcon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 capitalize truncate">
                        {step.type === 'query' ? 'Query' : step.type}
                      </span>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      step.status === 'success' ? 'bg-emerald-500' :
                      step.status === 'error' ? 'bg-red-500' :
                      step.status === 'skipped' ? 'bg-gray-400' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-medium ${stepStatus.color}`}>
                          {stepStatus.label}
                        </span>
                        {step.branch && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            step.branch === 'yes'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}>
                            {step.branch === 'yes' ? 'Yes branch' : 'No branch'}
                          </span>
                        )}
                        {step.rowCount !== undefined && (
                          <span className="text-[10px] text-gray-400">{step.rowCount} rows</span>
                        )}
                        {step.recipientCount !== undefined && (
                          <span className="text-[10px] text-gray-400">{step.recipientCount} recipients</span>
                        )}
                        {step.reason && (
                          <span className="text-[10px] text-gray-400 italic">{step.reason}</span>
                        )}
                      </div>
                      {step.error && (
                        <p className="text-[10px] text-red-500 font-mono mt-0.5 truncate">{step.error}</p>
                      )}
                      {step.startedAt && step.finishedAt && (
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {formatDuration(step.startedAt, step.finishedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {v1Summary && !isV2 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Summary
              </p>
              {(v1Summary.iterations as Array<Record<string, unknown>> | undefined)?.map((iter, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-gray-600 dark:text-gray-300">
                    Group: {String(iter.group || 'all')}
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">{String(iter.row_count || 0)} rows</span>
                  {iter.error && (
                    <span className="text-red-500 font-mono text-[10px] truncate">{String(iter.error)}</span>
                  )}
                </div>
              ))}
              {v1Summary.emails_sent !== undefined && (
                <p className="text-[11px] text-gray-500">Emails sent: {String(v1Summary.emails_sent)}</p>
              )}
              {v1Summary.exports_created !== undefined && (
                <p className="text-[11px] text-gray-500">Exports: {String(v1Summary.exports_created)}</p>
              )}
              {(v1Summary.email_recipients as string[] | undefined)?.length ? (
                <p className="text-[11px] text-gray-500">
                  Recipients: {(v1Summary.email_recipients as string[]).join(', ')}
                </p>
              ) : null}
            </div>
          )}

          {!isV2 && !v1Summary && !execution.error_message && (
            <p className="text-[11px] text-gray-400 italic">No detailed results available</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExecutionHistory({ pulseId, pulseName, onBack, onRerun, running }: ExecutionHistoryProps) {
  const [executions, setExecutions] = useState<PulseExecution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pulse_executions')
      .select('*')
      .eq('pulse_id', pulseId)
      .order('started_at', { ascending: false })
      .limit(50);
    setExecutions(data || []);
    setLoading(false);
  }, [pulseId]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Execution History
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {pulseName || 'Untitled Pulse'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchExecutions}>
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No executions yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Run the pulse manually or wait for the schedule
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {executions.map((exec) => (
              <ExecutionRow
                key={exec.id}
                execution={exec}
                onRerun={onRerun}
                running={running}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
