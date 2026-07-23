import { useEffect, useState, useCallback } from 'react';
import { Save, X, AlertCircle, Play, CheckCircle2, XCircle, Loader2, Copy, Workflow, History } from 'lucide-react';
import { type Node, type Edge } from 'reactflow';
import { supabase } from '../../lib/supabase';
import { useActiveDashboards } from '../../contexts/ActiveDashboardsContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePulses } from '../../hooks/usePulses';
import { usePulseConfig } from '../../hooks/usePulseConfig';
import { useProjects } from '../../hooks/useProjects';
import Button from '../../components/ui/Button';
import PulseTabs, { type PulseTabKey } from './PulseTabs';
import MainTab from './MainTab';
import ScheduleTab from './ScheduleTab';
import WorkflowCanvas from './WorkflowCanvas';
import ExecutionHistory from './ExecutionHistory';

import type {
  Pulse,
  PulseInsert,
  PulseEmail,
  PulseExport,
  PulseSchedule,
  PulseExecution,
  PulseStepConfig,
  PulseQueryStepConfig,
} from '../../types/database';

const emptyPulseDraft = (companyId: string, projectId: string, userId: string): PulseInsert => ({
  company_id: companyId,
  project_id: projectId,
  name: '',
  description: '',
  is_active: false,
  created_by: userId,
});

const emptyExportDraft = (): Partial<PulseExport> => ({
  enabled: false,
  format: 'csv',
  filename_template: '{pulse_name}_{date}',
  include_headers: true,
});

const emptyEmailDraft = (): Partial<PulseEmail> => ({
  enabled: false,
  to_recipients: [],
  cc_recipients: [],
  bcc_recipients: [],
  subject_template: '{pulse_name} – {date}',
  body_template: '',
  attach_export: true,
  only_send_if_results: true,
});

export default function PulseBuilder() {
  const { pulseBuilderProjectId, pulseBuilderPulseId, closePulseBuilder, openPulseBuilder } = useActiveDashboards();
  const { activeCompany, user } = useAuth();
  const { createPulse, updatePulse } = usePulses();
  const { refetch: refetchProjects } = useProjects();
  const {
    schedules,
    exportConfig: existingExport,
    email: existingEmail,
    refetch: refetchPulseConfig,
    saveSchedule,
    deleteSchedule,
    upsertExport,
    upsertEmail,
  } = usePulseConfig(pulseBuilderPulseId);

  const [activeTab, setActiveTab] = useState<PulseTabKey>('main');
  const [viewMode, setViewMode] = useState<'info' | 'workflow' | 'history'>('workflow');
  const [canvasNodes, setCanvasNodes] = useState<Node[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<Edge[]>([]);
  const [stepConfigs, setStepConfigs] = useState<Record<string, PulseStepConfig>>({});
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [pulseDraft, setPulseDraft] = useState<PulseInsert | null>(null);

  const [exportDraft, setExportDraft] = useState<Partial<PulseExport>>(emptyExportDraft());
  const [emailDraft, setEmailDraft] = useState<Partial<PulseEmail>>(emptyEmailDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [latestExecution, setLatestExecution] = useState<PulseExecution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activeCompany || !user || !pulseBuilderProjectId) return;
      setLoading(true);

      if (!pulseBuilderPulseId) {
        if (!cancelled) {
          setPulse(null);
          setPulseDraft(emptyPulseDraft(activeCompany.id, pulseBuilderProjectId, user.id));
          setExportDraft(emptyExportDraft());
          setEmailDraft(emptyEmailDraft());
          setCanvasNodes([]);
          setCanvasEdges([]);
          setStepConfigs({});
          setLoading(false);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('pulses')
        .select('*')
        .eq('id', pulseBuilderPulseId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
      } else if (data) {
        setPulse(data);
        setPulseDraft({
          company_id: data.company_id,
          project_id: data.project_id,
          name: data.name,
          description: data.description,
          is_active: data.is_active,

          parameter_values: data.parameter_values || {},
          trigger_type: data.trigger_type || 'scheduled',
          input_variables: data.input_variables || [],
        });
        if (data.canvas_data) {
          const cd = data.canvas_data as { nodes?: Node[]; edges?: Edge[] };
          setCanvasNodes(cd.nodes || []);
          setCanvasEdges(cd.edges || []);
        } else {
          setCanvasNodes([]);
          setCanvasEdges([]);
        }
        if (data.step_configs) {
          const loaded = data.step_configs as Record<string, PulseStepConfig>;
          // Seed run_mode/group_by_field from DB into the query step config (for backward compat)
          const queryKey = Object.keys(loaded).find(k => (loaded[k] as PulseQueryStepConfig).stepType === 'query');
          if (queryKey && data.run_mode) {
            const qc = loaded[queryKey] as PulseQueryStepConfig;
            if (!qc.runMode) {
              qc.runMode = data.run_mode as PulseQueryStepConfig['runMode'];
              qc.groupByField = data.group_by_field ?? null;
            }
          }
          setStepConfigs(loaded);
        } else {
          setStepConfigs({});
        }
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeCompany, user, pulseBuilderProjectId, pulseBuilderPulseId]);

  useEffect(() => {
    if (existingExport) {
      setExportDraft(existingExport);
    }
  }, [existingExport]);

  useEffect(() => {
    if (existingEmail) {
      setEmailDraft(existingEmail);
    }
  }, [existingEmail]);

  const fetchLatestExecution = useCallback(async () => {
    if (!pulseBuilderPulseId) {
      setLatestExecution(null);
      return;
    }
    const { data } = await supabase
      .from('pulse_executions')
      .select('*')
      .eq('pulse_id', pulseBuilderPulseId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatestExecution(data ?? null);
  }, [pulseBuilderPulseId]);

  useEffect(() => {
    fetchLatestExecution();
  }, [fetchLatestExecution]);

  const handleRunNow = async () => {
    if (!pulseBuilderPulseId) {
      setError('Save the pulse before running it.');
      return;
    }
    setRunning(true);
    setError(null);
    setRunMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pulse-runner`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ pulseId: pulseBuilderPulseId, triggerSource: 'manual' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        const msg = payload?.error || `Run failed (HTTP ${response.status})`;
        setError(msg);
      } else {
        setRunMessage('Pulse run completed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run pulse');
    } finally {
      setRunning(false);
      await fetchLatestExecution();
      const { data: refreshed } = await supabase
        .from('pulses')
        .select('*')
        .eq('id', pulseBuilderPulseId)
        .maybeSingle();
      if (refreshed) setPulse(refreshed);
    }
  };

  const handleDuplicate = async () => {
    if (!pulseBuilderPulseId || !pulse || !activeCompany || !user) return;
    setDuplicating(true);
    setError(null);
    try {
      const newName = `${pulse.name} (Copy)`;
      const insert: PulseInsert = {
        company_id: pulse.company_id,
        project_id: pulse.project_id,
        name: newName,
        description: pulse.description,
        is_active: false,
        query_id: pulse.query_id,
        run_mode: pulse.run_mode,
        group_by_field: pulse.group_by_field,
        parameter_values: pulse.parameter_values || {},
        created_by: user.id,
      };
      const { data: newPulse, error: insertErr } = await supabase
        .from('pulses')
        .insert(insert)
        .select()
        .maybeSingle();
      if (insertErr || !newPulse) {
        setError(insertErr?.message || 'Failed to duplicate pulse');
        return;
      }

      // Copy canvas data if present (v2 workflow)
      if (pulse.canvas_data || pulse.step_configs) {
        await supabase
          .from('pulses')
          .update({
            canvas_data: pulse.canvas_data,
            step_configs: pulse.step_configs,
            workflow_version: pulse.workflow_version || 1,
          })
          .eq('id', newPulse.id);
      }

      const copies: Promise<unknown>[] = [];
      if (existingExport) {
        copies.push(
          supabase.from('pulse_exports').insert({
            pulse_id: newPulse.id,
            enabled: existingExport.enabled,
            format: existingExport.format,
            filename_template: existingExport.filename_template,
            include_headers: existingExport.include_headers,
          })
        );
      }
      if (existingEmail) {
        copies.push(
          supabase.from('pulse_emails').insert({
            pulse_id: newPulse.id,
            enabled: existingEmail.enabled,
            to_recipients: existingEmail.to_recipients,
            cc_recipients: existingEmail.cc_recipients,
            bcc_recipients: existingEmail.bcc_recipients,
            subject_template: existingEmail.subject_template,
            body_template: existingEmail.body_template,
            attach_export: existingEmail.attach_export,
            only_send_if_results: existingEmail.only_send_if_results,
          })
        );
      }
      if (schedules.length > 0) {
        for (const sched of schedules) {
          copies.push(
            supabase.from('pulse_schedules').insert({
              pulse_id: newPulse.id,
              label: sched.label,
              enabled: false,
              cron_expression: sched.cron_expression,
              timezone: sched.timezone,
            })
          );
        }
      }
      await Promise.all(copies);

      await refetchProjects();
      closePulseBuilder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate pulse');
    } finally {
      setDuplicating(false);
    }
  };

  const handlePulseChange = useCallback((updates: Partial<PulseInsert>) => {
    setPulseDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const handleExportChange = useCallback((updates: Partial<PulseExport>) => {
    setExportDraft((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleEmailChange = useCallback((updates: Partial<PulseEmail>) => {
    setEmailDraft((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSave = async (overrideCanvas?: { nodes: Node[]; edges: Edge[]; configs: Record<string, PulseStepConfig> }) => {
    if (!pulseDraft || !pulseDraft.name?.trim()) {
      setError('A name is required.');
      setActiveTab('main');
      return;
    }
    setSaving(true);
    setError(null);

    const effectiveNodes = overrideCanvas?.nodes ?? canvasNodes;
    const effectiveEdges = overrideCanvas?.edges ?? canvasEdges;
    const effectiveConfigs = overrideCanvas?.configs ?? stepConfigs;

    try {
      let pulseId = pulseBuilderPulseId;

      if (!pulseId) {
        const result = await createPulse(
          pulseDraft.project_id,
          pulseDraft.name.trim(),
          pulseDraft.description || ''
        );
        if (result.error || !result.data) {
          setError(result.error || 'Failed to create pulse');
          setSaving(false);
          return;
        }
        pulseId = result.data.id;
        await updatePulse(pulseId, {
          is_active: pulseDraft.is_active,
          parameter_values: pulseDraft.parameter_values || {},
          trigger_type: pulseDraft.trigger_type || 'scheduled',
          input_variables: pulseDraft.input_variables || [],
          canvas_data: effectiveNodes.length > 0 ? { nodes: effectiveNodes, edges: effectiveEdges } : null,
          step_configs: Object.keys(effectiveConfigs).length > 0 ? effectiveConfigs : null,
          workflow_version: 2,
        });
        setPulse(result.data);
      } else {
        const update = await updatePulse(pulseId, {
          name: pulseDraft.name.trim(),
          description: pulseDraft.description,
          is_active: pulseDraft.is_active,
          parameter_values: pulseDraft.parameter_values || {},
          trigger_type: pulseDraft.trigger_type || 'scheduled',
          input_variables: pulseDraft.input_variables || [],
          canvas_data: effectiveNodes.length > 0 ? { nodes: effectiveNodes, edges: effectiveEdges } : null,
          step_configs: Object.keys(effectiveConfigs).length > 0 ? effectiveConfigs : null,
          workflow_version: 2,
        });
        if (update.error) {
          setError(update.error);
          setSaving(false);
          return;
        }
      }

      await Promise.all([
        upsertExport({
          pulse_id: pulseId!,
          enabled: exportDraft.enabled ?? false,
          format: exportDraft.format ?? 'csv',
          filename_template: exportDraft.filename_template ?? '{pulse_name}_{date}',
          include_headers: exportDraft.include_headers ?? true,
        }),
        upsertEmail({
          pulse_id: pulseId!,
          enabled: emailDraft.enabled ?? false,
          to_recipients: emailDraft.to_recipients ?? [],
          cc_recipients: emailDraft.cc_recipients ?? [],
          bcc_recipients: emailDraft.bcc_recipients ?? [],
          subject_template: emailDraft.subject_template ?? '',
          body_template: emailDraft.body_template ?? '',
          attach_export: emailDraft.attach_export ?? true,
          only_send_if_results: emailDraft.only_send_if_results ?? true,
          include_results_table: (emailDraft as Record<string, unknown>).include_results_table ?? false,
          results_table_columns: (emailDraft as Record<string, unknown>).results_table_columns ?? [],
          column_aliases: (emailDraft as Record<string, unknown>).column_aliases ?? {},
          column_formats: (emailDraft as Record<string, unknown>).column_formats ?? {},
          include_header_row: (emailDraft as Record<string, unknown>).include_header_row ?? true,
        }),
      ]);

      await refetchProjects();
      await refetchPulseConfig();

      if (!pulseBuilderPulseId && pulseId && pulseBuilderProjectId) {
        openPulseBuilder(pulseBuilderProjectId, pulseId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pulse');
    } finally {
      setSaving(false);
    }
  };

  const handleCanvasSave = (nodes: Node[], edges: Edge[], configs: Record<string, PulseStepConfig>) => {
    setCanvasNodes(nodes);
    setCanvasEdges(edges);
    setStepConfigs(configs);
    handleSave({ nodes, edges, configs });
  };

  if (loading || !pulseDraft) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (viewMode === 'history' && pulseBuilderPulseId) {
    return (
      <ExecutionHistory
        pulseId={pulseBuilderPulseId}
        pulseName={pulseDraft.name || ''}
        onBack={() => setViewMode('info')}
        onRerun={handleRunNow}
        running={running}
      />
    );
  }

  if (viewMode === 'workflow') {
    return (
      <WorkflowCanvas
        pulseName={pulseDraft.name || ''}
        initialNodes={canvasNodes.length > 0 ? canvasNodes : undefined}
        initialEdges={canvasEdges.length > 0 ? canvasEdges : undefined}
        initialStepConfigs={Object.keys(stepConfigs).length > 0 ? stepConfigs : undefined}
        onBack={() => setViewMode('info')}
        onSave={handleCanvasSave}
        onRunNow={pulseBuilderPulseId ? handleRunNow : undefined}
        saving={saving}
        running={running}
        isNew={!pulseBuilderPulseId}
        triggerType={(pulseDraft.trigger_type as 'scheduled' | 'action') || 'scheduled'}
        inputVariables={pulseDraft.input_variables as import('../../types/database').PulseInputVariable[] || []}
        schedules={schedules}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {pulseBuilderPulseId ? 'Edit Pulse' : 'New Pulse'}
            </p>
            <input
              type="text"
              value={pulseDraft.name || ''}
              onChange={(e) => handlePulseChange({ name: e.target.value })}
              placeholder="Untitled Pulse"
              className="w-full mt-0.5 text-xl font-semibold bg-transparent text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button variant="secondary" onClick={() => setViewMode('workflow')} disabled={saving || running || duplicating}>
              <Workflow className="w-4 h-4" />
              Workflow
            </Button>
            {pulseBuilderPulseId && (
              <>
                <Button variant="secondary" onClick={() => setViewMode('history')} disabled={saving || running || duplicating}>
                  <History className="w-4 h-4" />
                  History
                </Button>
                <Button variant="secondary" onClick={handleDuplicate} loading={duplicating} disabled={saving || running}>
                  <Copy className="w-4 h-4" />
                  Duplicate
                </Button>
                <Button variant="secondary" onClick={handleRunNow} loading={running} disabled={saving || duplicating}>
                  <Play className="w-4 h-4" />
                  Run Now
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={closePulseBuilder} disabled={saving || running || duplicating}>
              <X className="w-4 h-4" />
              Close
            </Button>
            <Button onClick={() => handleSave()} loading={saving} disabled={!pulseDraft.name?.trim() || running || duplicating}>
              <Save className="w-4 h-4" />
              Save
            </Button>
          </div>
        </div>
        <PulseTabs activeTab={activeTab} onChange={setActiveTab} showScheduleTab={pulseDraft?.trigger_type !== 'action'} />
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {runMessage && !error && (
        <div className="mx-6 mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">{runMessage}</p>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'main' && (
          <MainTab
            draft={pulseDraft}
            onChange={handlePulseChange}
            pulseId={pulseBuilderPulseId}
            createdAt={pulse?.created_at}
            updatedAt={pulse?.updated_at}
            lastRunAt={pulse?.last_run_at}
            lastRunStatus={pulse?.last_run_status}
          />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab
            pulseId={pulseBuilderPulseId}
            schedules={schedules}
            onSave={saveSchedule}
            onDelete={deleteSchedule}
            defaultTimezone={activeCompany?.default_timezone || 'UTC'}
          />
        )}
      </div>

      {(schedules.length > 0 || latestExecution || running) && (
        <div className="px-6 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div>
            {schedules.length > 0
              ? `Schedule: ${schedules.filter(s => s.enabled).length} active rule(s)`
              : 'Schedule: Not configured'}
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : latestExecution ? (
              <>
                {latestExecution.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                {latestExecution.status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-600" />}
                {latestExecution.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {latestExecution.status === 'partial' && <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
                <span className="capitalize">{latestExecution.status}</span>
                <span>·</span>
                <span>{latestExecution.row_count} rows</span>
                <span>·</span>
                <span>{new Date(latestExecution.started_at).toLocaleString()}</span>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
