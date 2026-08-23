import { useEffect } from 'react';
import { X, ExternalLink, Download } from 'lucide-react';

interface ReportViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectUrl: string | null;
  title: string;
  fileName?: string;
}

export default function ReportViewerModal({ isOpen, onClose, objectUrl, title, fileName }: ReportViewerModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !objectUrl) return null;

  const handleOpenInNewTab = () => {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName || 'report.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full h-[92vh] max-w-[100rem] bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-4">{title}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handleOpenInNewTab}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in new tab
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-gray-100 dark:bg-gray-900 overflow-hidden">
            <iframe
              src={objectUrl}
              title={title}
              className="w-full h-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
