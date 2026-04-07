import React from 'react';
import { AlertTriangle } from 'lucide-react';

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-slide-up">
        <div className="flex items-start gap-3 mb-4">
          {destructive && (
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-slate-900 text-lg">{title}</h3>
            <p className="text-slate-600 text-sm mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
