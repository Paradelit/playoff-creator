import React, { useState, useEffect, useRef, useId } from 'react';
import Dialog from './Dialog';

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
  const titleId = useId();
  const descId = useId();
  const inputId = useId();

  useEffect(() => {
    if (open) {
      setValue(defaultValue); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [open, defaultValue]);

  function handleSubmit(e) {
    e.preventDefault();
    if (value.trim()) onConfirm(value.trim());
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      labelledBy={titleId}
      describedBy={message ? descId : undefined}
      initialFocus={inputRef}
      closeOnBackdrop={false}
      panelClassName="bg-white rounded-xl shadow-xl max-w-sm w-full animate-slide-up"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <h2 id={titleId} className="font-semibold text-slate-900 text-lg mb-1">
          {title}
        </h2>
        {message && (
          <p id={descId} className="text-slate-600 text-sm mb-3">
            {message}
          </p>
        )}
        <label htmlFor={inputId} className="sr-only">
          {title}
        </label>
        <input
          ref={inputRef}
          id={inputId}
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
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
