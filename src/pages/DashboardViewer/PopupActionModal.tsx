import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

interface PopupActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  template: string;
  rowData: Record<string, unknown>;
}

export default function PopupActionModal({
  isOpen,
  onClose,
  title,
  template,
  rowData,
}: PopupActionModalProps) {
  const [copied, setCopied] = useState(false);
  const [editableText, setEditableText] = useState('');

  const renderedText = template.replace(/\{([^}]+)\}/g, (_match, fieldName) => {
    const value = rowData[fieldName];
    return value !== null && value !== undefined ? String(value) : '';
  });

  useEffect(() => {
    if (isOpen) {
      setEditableText(renderedText);
      setCopied(false);
    }
  }, [isOpen, renderedText]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        <div className="relative">
          <textarea
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            className="w-full text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 min-h-[280px] max-h-[500px] overflow-y-auto font-sans leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy to Clipboard
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
