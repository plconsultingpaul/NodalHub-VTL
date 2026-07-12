import { useCallback, useRef, useState, useEffect, useMemo, type DragEvent } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ArrowLeft, Save, Play, Map, LayoutGrid, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import NodePalette from './NodePalette';
import TriggerNode from './nodes/TriggerNode';
import ApiEndpointNode from './nodes/ApiEndpointNode';
import ConditionNode from './nodes/ConditionNode';
import EmailNode from './nodes/EmailNode';
import TriggerConfigPanel from './panels/TriggerConfigPanel';
import ApiEndpointConfigPanel from './panels/ApiEndpointConfigPanel';
import EmailConfigPanel from './panels/EmailConfigPanel';
import ConditionConfigPanel from './panels/ConditionConfigPanel';
import type { PulseStepConfig, PulseTriggerStepConfig, PulseQueryStepConfig, PulseConditionStepConfig, PulseEmailStepConfig, PulseInputVariable } from '../../types/database';

const nodeTypes = {
  trigger: TriggerNode,
  query: ApiEndpointNode,
  condition: ConditionNode,
  email: EmailNode,
};

const defaultTriggerNode: Node = {
  id: 'trigger-1',
  type: 'trigger',
  position: { x: 250, y: 50 },
  data: { label: 'Schedule', configured: false },
  deletable: false,
};

function briefCronDescription(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [minPart, hourPart, domPart, , dowPart] = parts;
  if (minPart === '*' && hourPart === '*') return 'Every minute';
  if (minPart.startsWith('*/') && hourPart === '*') return `Every ${minPart.slice(2)} min`;
  if (/^\d+$/.test(minPart) && hourPart === '*') return `Hourly at :${minPart.padStart(2, '0')}`;
  if (/^\d+$/.test(minPart) && hourPart.startsWith('*/'))
    return `Every ${hourPart.slice(2)}h at :${minPart.padStart(2, '0')}`;
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart === '*' && dowPart === '*') {
    const h = parseInt(hourPart);
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily ${h12}:${minPart.padStart(2, '0')} ${ap}`;
  }
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart === '*' && dowPart !== '*') {
    const dayNames: Record<string, string> = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat' };
    const days = dowPart.split(',').map(d => dayNames[d] || d).join(',');
    return `${days}`;
  }
  if (/^\d+$/.test(minPart) && /^\d+$/.test(hourPart) && domPart !== '*') return `Monthly (${domPart})`;
  return cron;
}

interface ValidationIssue {
  nodeId?: string;
  severity: 'error' | 'warning';
  message: string;
}

interface WorkflowCanvasProps {
  pulseName: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  initialStepConfigs?: Record<string, PulseStepConfig>;
  onBack: () => void;
  onSave: (nodes: Node[], edges: Edge[], stepConfigs: Record<string, PulseStepConfig>) => void;
  onRunNow?: () => void;
  saving?: boolean;
  running?: boolean;
  isNew?: boolean;
  triggerType?: 'scheduled' | 'action';
  inputVariables?: PulseInputVariable[];
}

let nodeId = 0;
const getNodeId = () => `node_${++nodeId}`;

export default function WorkflowCanvas({
  pulseName,
  initialNodes,
  initialEdges,
  initialStepConfigs,
  onBack,
  onSave,
  onRunNow,
  saving,
  running,
  isNew,
  triggerType,
  inputVariables,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [stepConfigs, setStepConfigs] = useState<Record<string, PulseStepConfig>>(
    initialStepConfigs || {}
  );

  const defaultTriggerForType: Node = {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 250, y: 50 },
    data: {
      label: triggerType === 'action' ? 'Action Trigger' : 'Schedule',
      configured: triggerType === 'action',
      triggerType: triggerType || 'scheduled',
      inputVariableCount: inputVariables?.length || 0,
    },
    deletable: false,
  };

  const startNodes = initialNodes && initialNodes.length > 0 ? initialNodes : [defaultTriggerForType];
  const [nodes, setNodes, onNodesChange] = useNodesState(startNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!saving && !running) {
          onSave(nodes, edges, stepConfigs);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, stepConfigs, saving, running, onSave]);

  const updateNodeData = useCallback((nodeId: string, dataUpdates: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...dataUpdates } } : n
      )
    );
    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...dataUpdates } } : prev);
    }
  }, [setNodes, selectedNode]);

  const handleStepConfigChange = useCallback((nodeId: string, config: PulseStepConfig) => {
    setStepConfigs((prev) => ({ ...prev, [nodeId]: config }));

    if (config.stepType === 'trigger') {
      const triggerConfig = config as PulseTriggerStepConfig;
      if (triggerType === 'action') {
        updateNodeData(nodeId, {
          configured: true,
          label: 'Action Trigger',
          triggerType: 'action',
          inputVariableCount: inputVariables?.length || 0,
          active: triggerConfig.active,
        });
      } else {
        const isConfigured = !!triggerConfig.cronExpression;
        const label = triggerConfig.active ? 'Schedule (Active)' : 'Schedule';
        const scheduleSummary = triggerConfig.cronExpression
          ? briefCronDescription(triggerConfig.cronExpression)
          : undefined;
        updateNodeData(nodeId, {
          configured: isConfigured,
          label,
          scheduleSummary,
          active: triggerConfig.active,
          triggerType: 'scheduled',
        });
      }
    } else if (config.stepType === 'query') {
      const apiConfig = config as PulseQueryStepConfig;
      const isConfigured = !!apiConfig.queryId;
      const label = apiConfig.stepName || 'Query';
      updateNodeData(nodeId, {
        configured: isConfigured,
        label,
        stepName: apiConfig.stepName,
        queryName: apiConfig.queryName,
      });
    } else if (config.stepType === 'condition') {
      const condConfig = config as PulseConditionStepConfig;
      const conditions = condConfig.conditions || [];
      const isConfigured = conditions.length > 0;
      const label = condConfig.name || 'Condition';
      const conditionCount = conditions.length;
      const conditionSummary = conditionCount > 0
        ? `${conditionCount} rule${conditionCount > 1 ? 's' : ''} (${condConfig.logicMode === 'all' ? 'AND' : 'OR'})`
        : undefined;
      updateNodeData(nodeId, {
        configured: isConfigured,
        label,
        conditionCount,
        conditionSummary,
      });
    } else if (config.stepType === 'email') {
      const emailConfig = config as PulseEmailStepConfig;
      const toRecipients = emailConfig.toRecipients || [];
      const isConfigured = toRecipients.length > 0 && !!emailConfig.subject;
      const label = emailConfig.name || 'Email';
      const recipientCount = toRecipients.length + (emailConfig.ccRecipients?.length || 0) + (emailConfig.bccRecipients?.length || 0);
      updateNodeData(nodeId, {
        configured: isConfigured,
        label,
        stepName: emailConfig.name,
        recipientCount,
      });
    }
  }, [updateNodeData]);

  const onConnect = useCallback(
    (params: Connection) => {
      const edgeStyle: Partial<Edge> = {};
      if (params.sourceHandle === 'yes') {
        edgeStyle.style = { stroke: '#22c55e' };
        edgeStyle.label = 'Yes';
        edgeStyle.labelStyle = { fill: '#22c55e', fontWeight: 600, fontSize: 11 };
      } else if (params.sourceHandle === 'no') {
        edgeStyle.style = { stroke: '#ef4444' };
        edgeStyle.label = 'No';
        edgeStyle.labelStyle = { fill: '#ef4444', fontWeight: 600, fontSize: 11 };
      }
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...edgeStyle,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            animated: false,
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setStepConfigs((prev) => {
      const updated = { ...prev };
      delete updated[nodeId];
      return updated;
    });
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  }, [setNodes, setEdges, selectedNode]);

  const copyNode = useCallback((nodeId: string) => {
    const sourceNode = nodes.find((n) => n.id === nodeId);
    if (!sourceNode) return;

    const newId = getNodeId();
    const newNode: Node = {
      id: newId,
      type: sourceNode.type,
      position: { x: sourceNode.position.x + 40, y: sourceNode.position.y + 40 },
      data: { ...sourceNode.data },
    };
    setNodes((nds) => [...nds, newNode]);

    if (stepConfigs[nodeId]) {
      setStepConfigs((prev) => ({ ...prev, [newId]: { ...prev[nodeId] } }));
    }
  }, [nodes, setNodes, stepConfigs]);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const labelMap: Record<string, string> = {
        query: 'Query',
        condition: 'Condition',
        email: 'Email',
      };

      const newNode: Node = {
        id: getNodeId(),
        type,
        position,
        data: { label: labelMap[type] || type, configured: false },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, setNodes]
  );

  const enrichedNodes = useMemo(() =>
    nodes.map((n) =>
      n.type === 'trigger'
        ? n
        : { ...n, data: { ...n.data, onDelete: deleteNode, onCopy: copyNode } }
    ),
    [nodes, deleteNode, copyNode]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Auto-layout: arrange nodes in a vertical tree
  const handleAutoLayout = useCallback(() => {
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) return;

    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source)!.push(edge.target);
    }

    const positioned = new Map<string, { x: number; y: number }>();
    const visited = new Set<string>();
    const VERTICAL_GAP = 120;
    const HORIZONTAL_GAP = 220;

    const layout = (nodeId: string, x: number, y: number, level: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      positioned.set(nodeId, { x, y });

      const children = adjacency.get(nodeId) || [];
      if (children.length === 0) return;

      const totalWidth = (children.length - 1) * HORIZONTAL_GAP;
      const startX = x - totalWidth / 2;

      children.forEach((childId, i) => {
        layout(childId, startX + i * HORIZONTAL_GAP, y + VERTICAL_GAP, level + 1);
      });
    };

    layout(triggerNode.id, 300, 50, 0);

    // Position orphan nodes below
    let orphanY = (positioned.size + 1) * VERTICAL_GAP;
    nodes.forEach(n => {
      if (!positioned.has(n.id)) {
        positioned.set(n.id, { x: 300, y: orphanY });
        orphanY += VERTICAL_GAP;
      }
    });

    setNodes(nds => nds.map(n => {
      const pos = positioned.get(n.id);
      return pos ? { ...n, position: pos } : n;
    }));

    setTimeout(() => reactFlowInstance?.fitView({ padding: 0.3, maxZoom: 0.75 }), 50);
  }, [nodes, edges, setNodes, reactFlowInstance]);

  // Validation
  const getValidationIssues = useCallback((): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      issues.push({ severity: 'error', message: 'Workflow must have a Trigger node' });
    }

    const actionNodes = nodes.filter(n => n.type !== 'trigger');
    if (actionNodes.length === 0) {
      issues.push({ severity: 'warning', message: 'No action nodes in workflow' });
    }

    // Check for orphaned nodes (not connected to anything)
    const connectedNodes = new Set<string>();
    edges.forEach(e => { connectedNodes.add(e.source); connectedNodes.add(e.target); });
    nodes.forEach(n => {
      if (!connectedNodes.has(n.id) && n.type !== 'trigger') {
        issues.push({ nodeId: n.id, severity: 'warning', message: `"${n.data.label || n.type}" is not connected` });
      }
    });

    // Check trigger has at least one outgoing edge
    if (triggerNode) {
      const triggerEdges = edges.filter(e => e.source === triggerNode.id);
      if (triggerEdges.length === 0 && actionNodes.length > 0) {
        issues.push({ nodeId: triggerNode.id, severity: 'error', message: 'Trigger has no outgoing connections' });
      }
    }

    // Check unconfigured nodes
    nodes.forEach(n => {
      if (!n.data.configured) {
        const label = n.data.label || n.type;
        issues.push({ nodeId: n.id, severity: 'error', message: `"${label}" is not configured` });
      }
    });

    return issues;
  }, [nodes, edges]);

  const validationIssues = getValidationIssues();
  const errorCount = validationIssues.filter(i => i.severity === 'error').length;
  const warningCount = validationIssues.filter(i => i.severity === 'warning').length;

  const handleSave = () => {
    onSave(nodes, edges, stepConfigs);
  };

  // Delete node handler with confirmation for non-trigger
  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    const nonTrigger = deletedNodes.filter(n => n.type !== 'trigger');
    nonTrigger.forEach(n => {
      setStepConfigs(prev => {
        const updated = { ...prev };
        delete updated[n.id];
        return updated;
      });
    });
    if (selectedNode && nonTrigger.some(n => n.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [selectedNode]);

  const renderConfigPanel = () => {
    if (!selectedNode) return null;

    if (selectedNode.type === 'trigger') {
      const config = stepConfigs[selectedNode.id] as PulseTriggerStepConfig | undefined;
      return (
        <TriggerConfigPanel
          config={config || null}
          onChange={(newConfig) => handleStepConfigChange(selectedNode.id, newConfig)}
          triggerType={triggerType}
          inputVariables={inputVariables}
        />
      );
    }

    if (selectedNode.type === 'query') {
      const config = stepConfigs[selectedNode.id] as PulseQueryStepConfig | undefined;
      return (
        <ApiEndpointConfigPanel
          config={config || null}
          onChange={(newConfig) => handleStepConfigChange(selectedNode.id, newConfig)}
          inputVariables={inputVariables}
        />
      );
    }

    if (selectedNode.type === 'condition') {
      const config = stepConfigs[selectedNode.id] as PulseConditionStepConfig | undefined;
      const upstreamVariables = nodes
        .filter(n => n.type === 'query' && stepConfigs[n.id])
        .map(n => (stepConfigs[n.id] as PulseQueryStepConfig).responseVariableName)
        .filter((v): v is string => !!v);
      return (
        <ConditionConfigPanel
          config={config || null}
          onChange={(newConfig) => handleStepConfigChange(selectedNode.id, newConfig)}
          upstreamVariables={upstreamVariables}
          inputVariables={inputVariables}
        />
      );
    }

    if (selectedNode.type === 'email') {
      const config = stepConfigs[selectedNode.id] as PulseEmailStepConfig | undefined;
      const upstreamApiNodes = nodes
        .filter(n => n.type === 'query' && stepConfigs[n.id])
        .map(n => ({ id: n.id, label: (stepConfigs[n.id] as PulseQueryStepConfig).stepName || 'Query', queryId: (stepConfigs[n.id] as PulseQueryStepConfig).queryId }));
      return (
        <EmailConfigPanel
          config={config || null}
          onChange={(newConfig) => handleStepConfigChange(selectedNode.id, newConfig)}
          upstreamNodes={upstreamApiNodes}
          inputVariables={inputVariables}
        />
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Select a node to configure it.
        </p>
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5 uppercase tracking-wider">
              Type
            </label>
            <p className="text-xs text-gray-800 dark:text-gray-200 capitalize">
              {selectedNode.type === 'query' ? 'Query' : selectedNode.type}
            </p>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5 uppercase tracking-wider">
              ID
            </label>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
              {selectedNode.id}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Workflow
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {pulseName || 'Untitled Pulse'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Validation indicator */}
          <button
            onClick={() => setShowValidation(v => !v)}
            className={`relative p-2 rounded-md transition-colors ${
              showValidation
                ? 'bg-gray-200 dark:bg-gray-700'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${errorCount > 0 ? 'text-red-500' : warningCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}
            title={`${errorCount} errors, ${warningCount} warnings`}
          >
            {errorCount > 0 ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {(errorCount + warningCount) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {errorCount + warningCount}
              </span>
            )}
          </button>
          <button
            onClick={handleAutoLayout}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            title="Auto-layout nodes"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowMinimap((v) => !v)}
            className={`p-2 rounded-md transition-colors ${
              showMinimap
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}
            title="Toggle minimap"
          >
            <Map className="w-4 h-4" />
          </button>
          {onRunNow && !isNew && (
            <Button variant="secondary" onClick={onRunNow} loading={running} disabled={saving} size="sm">
              <Play className="w-3.5 h-3.5" />
              Run
            </Button>
          )}
          <Button onClick={handleSave} loading={saving} disabled={running} size="sm">
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Validation panel */}
      {showValidation && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Validation ({validationIssues.length} issue{validationIssues.length !== 1 ? 's' : ''})
            </p>
            <button onClick={() => setShowValidation(false)} className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X className="w-3 h-3 text-gray-400" />
            </button>
          </div>
          {validationIssues.length === 0 ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs">All validations pass</span>
            </div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {validationIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    issue.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                  <span className={`text-[11px] ${
                    issue.severity === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {issue.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Canvas area */}
      <div className="flex-1 flex overflow-hidden">
        <NodePalette />
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={enrichedNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodesDelete={onNodesDelete}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 0.75 }}
            deleteKeyCode={['Backspace', 'Delete']}
            className="bg-gray-50 dark:bg-gray-900"
          >
            <Background color="#94a3b8" gap={20} size={1} />
            <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !shadow-lg" />
            {showMinimap && (
              <MiniMap
                className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
                nodeColor={(n) => {
                  switch (n.type) {
                    case 'trigger': return '#3b82f6';
                    case 'query': return '#22c55e';
                    case 'condition': return '#f59e0b';
                    case 'email': return '#8b5cf6';
                    default: return '#6b7280';
                  }
                }}
              />
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Node configuration modal */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedNode(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedNode.type === 'trigger' ? 'Trigger' :
                   selectedNode.type === 'query' ? 'Query' :
                   selectedNode.type === 'condition' ? 'Condition' :
                   selectedNode.type === 'email' ? 'Email' : 'Configure Node'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Configure step behavior and parameters
                </p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {renderConfigPanel()}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="secondary" onClick={() => setSelectedNode(null)}>
                Cancel
              </Button>
              <Button onClick={() => setSelectedNode(null)}>
                Save Step
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
