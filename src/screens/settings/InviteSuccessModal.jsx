import React, { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';

export function InviteSuccessModal({ link, onClose }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between mb-3">
          <h2 className="text-lg font-semibold">Invitación creada</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-3">Comparte este enlace por WhatsApp o email. Caduca en 7 días.</p>
        <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded p-2 mb-4">
          <code className="text-xs text-slate-700 truncate flex-1">{link}</code>
          <button
            type="button"
            onClick={copy}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded inline-flex items-center gap-1"
            aria-label="Copiar al portapapeles"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-slate-100 rounded">
            Hecho
          </button>
        </div>
      </div>
    </div>
  );
}
