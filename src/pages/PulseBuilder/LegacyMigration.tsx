import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, AlertTriangle, CheckCircle2, Loader2, Zap, Globe, Mail } from 'lucide-react';
import { type Node, type Edge } from 'reactflow';
import Button from '../../components/ui/Button';
import type {
  PulseInsert,
  PulseSchedule,
  PulseExport,
  PulseEmail,
  PulseStepConfig,
  PulseTriggerStepConfig,
  PulseQueryStepConfig,
  PulseEmailStepConfig,
} from '../../types/database';

interface LegacyMigrationProps {
  pulseDraft: PulseInsert;
  schedule: PulseSchedule | null;
  exportConfig: PulseExport | null;
  email: PulseEmail | null;
  onConvert: (nodes: Node[], edges: Edge[], configs: Record<string, PulseStepConfig>) => void;
  onCancel: () => void;
  saving?: boolean;
}

interface ConversionPreviewNode {
  id: string;
  type: string;
  label: string;
  description: string;
}

const NODE_SPACING_Y = 160;
const NODE_X = 250;

function generateId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildConversion(
  pulseDraft: PulseInsert,
  schedule: PulseSchedule | null,
  exportConfig: PulseExport | null,
  email: PulseEmail | null
): {
  nodes: Node[];
  edges: Edge[];
  configs: Record<string, PulseStepConfig>;
  preview: ConversionPreviewNode[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const configs: Record<string, PulseStepConfig> = {};
  const preview: ConversionPreviewNode[] = [];
  let yPos = 0;

  // 1. Trigger node (from schedule)
  const triggerId = generateId();
  const triggerConfig: PulseTriggerStepConfig = {
    stepType: 'trigger',
    scheduleType: 'cron',
    cronExpression: schedule?.cron_expression || '0 8 * * *',
    timezone: schedule?.timezone || 'UTC',
    active: schedule?.enabled ?? false,
  };

  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: NODE_X, y: yPos },
    data: { label: 'Trigger', stepName: 'Schedule Trigger', configured: true },
    deletable: false,
  });
  configs[triggerId] = triggerConfig;
  preview.push({
    id: triggerId,
    type: 'trigger',
    label: 'Schedule Trigger',
    description: schedule?.enabled
      ? `Cron: ${schedule.cron_expression} (${schedule.timezone})`
      : 'Disabled schedule (will be inactive)',
  });

  let prevNodeId = triggerId;
  yPos += NODE_SPACING_Y;

  // 2. API Endpoint node (from query_id + parameter_values)
  if (pulseDraft.query_id) {
    const apiId = generateId();
    const apiConfig: PulseQueryStepConfig = {
      stepType: 'query',
      name: 'Fetch Data',
      stepName: 'Fetch Data',
      queryId: pulseDraft.query_id,
      parameterValues: pulseDraft.parameter_values || {},
      responseVariableName: 'queryResults',
      onError: 'stop',
    };

    nodes.push({
      id: apiId,
      type: 'query',
      position: { x: NODE_X, y: yPos },
      data: { label: 'Query', stepName: 'Fetch Data', configured: true },
    });
    configs[apiId] = apiConfig;
    preview.push({
      id: apiId,
      type: 'query',
      label: 'Fetch Data',
      description: `Query ID: ${pulseDraft.query_id.slice(0, 8)}...`,
    });

    edges.push({
      id: `edge_${prevNodeId}_${apiId}`,
      source: prevNodeId,
      target: apiId,
      animated: true,
    });
    prevNodeId = apiId;
    yPos += NODE_SPACING_Y;
  }

  // 3. Email node (from pulse_emails + pulse_exports)
  if (email?.enabled) {
    const emailId = generateId();
    const emailConfig: PulseEmailStepConfig = {
      stepType: 'email',
      name: 'Send Email',
      toRecipients: email.to_recipients || [],
      ccRecipients: email.cc_recipients || [],
      bccRecipients: email.bcc_recipients || [],
      subject: email.subject_template || '{pulse_name} - {date}',
      bodyType: 'html',
      body: email.body_template || '',
      includeAttachment: exportConfig?.enabled && email.attach_export ? true : false,
      attachmentFormat: exportConfig?.format || 'csv',
      attachmentFilename: exportConfig?.filename_template || '{pulse_name}_{date}',
      dataSource: 'queryResults',
      onlySendIfResults: email.only_send_if_results ?? true,
    };

    nodes.push({
      id: emailId,
      type: 'email',
      position: { x: NODE_X, y: yPos },
      data: { label: 'Email', stepName: 'Send Email', configured: true },
    });
    configs[emailId] = emailConfig;

    const recipientCount = (email.to_recipients?.length || 0) +
      (email.cc_recipients?.length || 0) +
      (email.bcc_recipients?.length || 0);
    preview.push({
      id: emailId,
      type: 'email',
      label: 'Send Email',
      description: `${recipientCount} recipient(s)${email.attach_export && exportConfig?.enabled ? ` + ${exportConfig.format.toUpperCase()} attachment` : ''}`,
    });

    edges.push({
      id: `edge_${prevNodeId}_${emailId}`,
      source: prevNodeId,
      target: emailId,
      animated: true,
    });
    prevNodeId = emailId;
    yPos += NODE_SPACING_Y;
  }

  return { nodes, edges, configs, preview };
}

const STEP_ICONS: Record<string, typeof Zap> = {
  trigger: Zap,
  query: Globe,
  email: Mail,
};

export default function LegacyMigration({
  pulseDraft,
  schedule,
  exportConfig,
  email,
  onConvert,
  onCancel,
  saving,
}: LegacyMigrationProps) {
  const [confirmed, setConfirmed] = useState(false);

  const { nodes, edges, configs, preview } = useMemo(
    () => buildConversion(pulseDraft, schedule, exportConfig, email),
    [pulseDraft, schedule, exportConfig, email]
  );

  const handleConfirm = () => {
    setConfirmed(true);
    onConvert(nodes, edges, configs);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Legacy Migration
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Convert to Workflow Canvas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={saving} disabled={confirmed}>
            <Sparkles className="w-4 h-4" />
            Convert & Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Info banner */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                Automatic Conversion
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                This will generate a visual workflow from your existing tab-based configuration.
                Your original settings remain intact — this only adds the new workflow canvas data.
              </p>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Generated Workflow Preview
              </p>
            </div>
            <div className="p-4">
              {preview.length === 0 ? (
                <div className="text-center py-6">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No configuration found to convert. Add a query or email first.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {preview.map((node, index) => {
                    const Icon = STEP_ICONS[node.type] || Zap;
                    return (
                      <div key={node.id}>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700">
                          <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {node.label}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {node.description}
                            </p>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        </div>
                        {index < preview.length - 1 && (
                          <div className="flex justify-center py-1">
                            <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 rotate-90" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* What changes */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                What Happens
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Workflow canvas is populated with nodes from your current config
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Pulse version set to v2 (uses the workflow engine for execution)
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Original tab settings are preserved (non-destructive)
                </p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  After conversion, the pulse will run using the new workflow engine
                </p>
              </div>
            </div>
          </div>

          {confirmed && (
            <div className="flex items-center gap-2 justify-center text-sm text-emerald-600 dark:text-emerald-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Converting and saving...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
