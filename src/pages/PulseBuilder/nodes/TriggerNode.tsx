import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Clock, Zap } from 'lucide-react';

interface TriggerNodeData {
  label: string;
  configured?: boolean;
  scheduleSummary?: string;
  active?: boolean;
  triggerType?: 'scheduled' | 'action';
  inputVariableCount?: number;
}

function TriggerNode({ data, selected }: NodeProps<TriggerNodeData>) {
  const isAction = data.triggerType === 'action';

  return (
    <div
      className={`relative px-4 py-3 rounded-lg border-2 shadow-sm min-w-[180px] transition-all ${
        selected
          ? isAction
            ? 'border-indigo-500 shadow-indigo-100 dark:shadow-indigo-900/30'
            : 'border-blue-500 shadow-blue-100 dark:shadow-blue-900/30'
          : data.configured
          ? isAction
            ? 'border-indigo-300 dark:border-indigo-700'
            : 'border-blue-300 dark:border-blue-700'
          : 'border-red-300 dark:border-red-700'
      } bg-white dark:bg-gray-800`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
          isAction
            ? 'bg-indigo-100 dark:bg-indigo-900/40'
            : 'bg-blue-100 dark:bg-blue-900/40'
        }`}>
          {isAction ? (
            <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${
            isAction
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}>
            Trigger
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {data.label || (isAction ? 'Action' : 'Schedule')}
          </p>
        </div>
      </div>
      {!isAction && data.configured && data.scheduleSummary && (
        <div className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400 truncate">
          {data.scheduleSummary}
        </div>
      )}
      {isAction && data.inputVariableCount !== undefined && data.inputVariableCount > 0 && (
        <div className="mt-1.5 text-[10px] text-indigo-600 dark:text-indigo-400">
          {data.inputVariableCount} input variable{data.inputVariableCount !== 1 ? 's' : ''}
        </div>
      )}
      {data.configured && data.active !== undefined && (
        <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-medium ${
          data.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${data.active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
          {data.active ? 'Active' : 'Paused'}
        </div>
      )}
      {!data.configured && !isAction && (
        <div className="mt-1.5 text-[10px] text-red-500 font-medium">Not configured</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-3 !h-3 !border-2 !border-white dark:!border-gray-800 ${
          isAction ? '!bg-indigo-500' : '!bg-blue-500'
        }`}
      />
    </div>
  );
}

export default memo(TriggerNode);
