import React, { useState, useEffect, useRef } from 'react';

/**
 * Modal prompt dialog — replaces window.prompt().
 *
 * Props:
 *  - open: boolean
 *  - title: string
 *  - message?: string
 *  - defaultValue?: string
 *  - placeholder?: string
 *  - confirmLabel?: string (default "Guardar")
 *  - cancelLabel?: string (default "Cancelar")
 *  - onConfirm: (value: string) => void
 *  - onCancel: () => void
 */
export default function PromptDialog({
  open,
  title,
  message,
  defaultValue = '',
  placeholder = '',
  confirmLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  // Reset value and focus input when dialog opens
  useEffect(() => {
    if (open) {
      setValue(defaultValue); // eslint-disable-line react-hooks/set-state-in-effect
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (value.trim()) onConfirm(value.trim());
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-slide-up">
        <h3 className="font-semibold text-slate-900 text-lg mb-1">{title}</h3>
        {message && <p className="text-slate-600 text-sm mb-3">{message}</p>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none mb-4"
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
