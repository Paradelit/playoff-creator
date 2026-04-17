import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export default function ToolbarOverflowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Más acciones"
        title="Más acciones"
        className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-blue-800 hover:bg-blue-700 text-white shadow-sm transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[210px]">
          {visible.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                disabled={item.disabled}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'}`}
              >
                {Icon && <Icon size={15} />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
