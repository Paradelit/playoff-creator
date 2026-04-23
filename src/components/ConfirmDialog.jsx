import React, { useId, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import Dialog from './Dialog';

/**
 * Modal confirmation dialog — replaces window.confirm().
 *
 * Props:
 *  - open: boolean
 *  - title: string
 *  - message: string
 *  - confirmLabel?: string (default "Confirmar")
 *  - cancelLabel?: string (default "Cancelar")
 *  - destructive?: boolean (red confirm button)
 *  - onConfirm: () => void
 *  - onCancel: () => void
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef(null);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      labelledBy={titleId}
      describedBy={descId}
      initialFocus={cancelRef}
      closeOnBackdrop={!destructive}
    >
      <div className="flex items-start gap-3 mb-4">
        {destructive && (
          <div
            aria-hidden="true"
            className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0"
          >
            <AlertTriangle size={20} className="text-red-600" aria-hidden="true" />
          </div>
        )}
        <div>
          <h2 id={titleId} className="font-semibold text-slate-900 text-lg">
            {title}
          </h2>
          <p id={descId} className="text-slate-600 text-sm mt-1">
            {message}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            destructive
              ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-400'
              : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-400'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
