import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, X } from 'lucide-react';

export interface ActionToastData {
  id: string;
  type: 'success' | 'error' | 'progress';
  message: string;
  detail?: string;
  progress?: { current: number; total: number };
}

interface ActionToastProps {
  toasts: ActionToastData[];
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: { toast: ActionToastData; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    if (toast.type !== 'progress') {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 200);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.type, onDismiss]);

  const bgClass = toast.type === 'success'
    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700'
    : toast.type === 'error'
    ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700'
    : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700';

  const iconClass = toast.type === 'success'
    ? 'text-emerald-600 dark:text-emerald-400'
    : toast.type === 'error'
    ? 'text-red-600 dark:text-red-400'
    : 'text-blue-600 dark:text-blue-400';

  const textClass = toast.type === 'success'
    ? 'text-emerald-800 dark:text-emerald-200'
    : toast.type === 'error'
    ? 'text-red-800 dark:text-red-200'
    : 'text-blue-800 dark:text-blue-200';

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-200 ${bgClass} ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
    >
      <div className={`shrink-0 mt-0.5 ${iconClass}`}>
        {toast.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
        {toast.type === 'error' && <XCircle className="w-4 h-4" />}
        {toast.type === 'progress' && <Loader2 className="w-4 h-4 animate-spin" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textClass}`}>{toast.message}</p>
        {toast.detail && (
          <p className={`text-xs mt-0.5 opacity-80 ${textClass}`}>{toast.detail}</p>
        )}
        {toast.progress && (
          <div className="mt-2">
            <div className="h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${(toast.progress.current / toast.progress.total) * 100}%` }}
              />
            </div>
            <p className={`text-xs mt-1 ${textClass}`}>
              {toast.progress.current} of {toast.progress.total}
            </p>
          </div>
        )}
      </div>
      {toast.type !== 'progress' && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function ActionToast({ toasts, onDismiss }: ActionToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}
