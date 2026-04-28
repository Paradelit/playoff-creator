import React, { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';

export default function ExportMenu({ items = [], status }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleSelect(item) {
    setOpen(false);
    if (typeof item.onClick === 'function') item.onClick();
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-3 print:hidden">
      {status && (
        <span className="text-xs font-semibold text-slate-400">
          {status === 'saving' && 'Guardando...'}
          {status === 'saved' && '✓ Guardado'}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={15} aria-hidden="true" /> Exportar
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-[200px] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-20"
        >
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {item.icon && <span aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
