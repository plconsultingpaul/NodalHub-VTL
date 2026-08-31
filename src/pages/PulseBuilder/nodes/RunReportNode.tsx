import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { FileText, Trash2, Copy, Check, X } from 'lucide-react';

interface RunReportNodeData {
  label: string;
  stepName?: string;
  configured?: boolean;
  actionName?: string;
  responseVariableName?: string;
  onDelete?: (id: string) => void;
  onCopy?: (id: string) => void;
}

function RunReportNode({ id, data, selected }: NodeProps<RunReportNodeData>) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      className={`group relative px-4 py-3 rounded-lg border-2 shadow-sm min-w-[180px] transition-all ${
        selected
          ? 'border-rose-500 shadow-rose-100 dark:shadow-rose-900/30'
          : data.configured
          ? 'border-rose-300 dark:border-rose-700'
          : 'border-red-300 dark:border-red-700'
      } bg-white dark:bg-gray-800`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white dark:!border-gray-800"
      />
      <div className={`absolute -top-2 -right-2 flex items-center gap-0.5 transition-opacity ${confirmingDelete ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {confirmingDelete ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); data.onDelete?.(id); }}
              className="w-5 h-5 rounded bg-red-500 border border-red-600 flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
              title="Confirm delete"
            >
              <Check className="w-3 h-3 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false); }}
              className="w-5 h-5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Cancel"
            >
              <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); data.onCopy?.(id); }}
              className="w-5 h-5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Copy node"
            >
              <Copy className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true); }}
              className="w-5 h-5 rounded bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 flex items-center justify-center shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              title="Delete node"
            >
              <Trash2 className="w-3 h-3 text-red-500" />
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-md bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-semibold">
            Run Report
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {data.stepName || data.label || 'Untitled'}
          </p>
        </div>
      </div>
      {data.configured && data.actionName && (
        <div className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400 truncate">
          {data.actionName}
        </div>
      )}
      {data.configured && data.responseVariableName && (
        <div className="mt-0.5 text-[10px] text-rose-500 dark:text-rose-400 font-mono truncate">
          {`{{${data.responseVariableName}}}`}
        </div>
      )}
      {!data.configured && (
        <div className="mt-1.5 text-[10px] text-red-500 font-medium">Not configured</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white dark:!border-gray-800"
      />
    </div>
  );
}

export default memo(RunReportNode);
