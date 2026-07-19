import { type DragEvent } from 'react';
import { Clock, Database, GitBranch, Mail, Zap } from 'lucide-react';

const nodeTypes = [
  {
    type: 'trigger',
    label: 'Trigger',
    description: 'Schedule / Cadence',
    icon: Clock,
    color: 'blue',
    disabled: true,
  },
  {
    type: 'query',
    label: 'Query',
    description: 'Run a saved query',
    icon: Database,
    color: 'green',
    disabled: false,
  },
  {
    type: 'action',
    label: 'Action',
    description: 'Run a post-query action',
    icon: Zap,
    color: 'orange',
    disabled: false,
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch on logic',
    icon: GitBranch,
    color: 'amber',
    disabled: false,
  },
  {
    type: 'email',
    label: 'Email',
    description: 'Send email with data',
    icon: Mail,
    color: 'violet',
    disabled: false,
  },
] as const;

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
};

export default function NodePalette() {
  const onDragStart = (event: DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Add Node
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {nodeTypes.map((node) => {
          const colors = colorMap[node.color];
          const Icon = node.icon;
          return (
            <div
              key={node.type}
              draggable={!node.disabled}
              onDragStart={(e) => onDragStart(e, node.type)}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
                node.disabled
                  ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                  : `${colors.bg} ${colors.border} hover:shadow-sm`
              }`}
              title={node.disabled ? 'Trigger is auto-placed' : `Drag to add ${node.label}`}
            >
              <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${node.disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                  {node.label}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  {node.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
          Drag nodes onto the canvas
        </p>
      </div>
    </div>
  );
}
