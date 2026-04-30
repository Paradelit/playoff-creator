import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';
import { usePick } from '../../contexts/PickProvider';

interface Props {
  animating?: boolean;
}

export default function PickCompact({ animating }: Props) {
  const { setMode, currentTip, dismissTip } = usePick();

  return (
    <div
      className={`fixed bottom-20 right-4 z-50 flex items-end gap-2 print:hidden ${animating ? 'animate-pick-collapse' : ''}`}
    >
      {/* Speech bubble */}
      {currentTip && !animating && (
        <div className="animate-pick-fade-in flex items-center gap-2 bg-white shadow-lg rounded-xl px-3.5 py-2.5 max-w-[220px] border border-orange-200">
          <button
            onClick={() => setMode('panel')}
            className="text-sm text-slate-700 font-medium text-left flex-1 leading-snug"
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="text-sm text-slate-700 font-medium text-left flex-1 leading-snug">{children}</p>
                ),
                strong: ({ children }) => <strong className="font-bold text-orange-700">{children}</strong>,
              }}
            >
              {currentTip}
            </ReactMarkdown>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismissTip();
            }}
            className="text-slate-400 hover:text-slate-600 shrink-0 p-0.5"
            aria-label="Cerrar sugerencia"
          >
            <X size={14} />
          </button>
          {/* Triangle pointing right to Pick's avatar button */}
          <div className="absolute -right-1.5 bottom-3.5 w-3 h-3 bg-white border-r border-b border-orange-200 rotate-[-45deg]" />
        </div>
      )}

      {/* Pick avatar — Court Orange gradient + "P" per DESIGN.md spec */}
      <button
        onClick={() => setMode('panel')}
        className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
        style={{
          background: 'linear-gradient(135deg, #f97316, #ea580c)',
        }}
        aria-label="Abrir Pick"
      >
        <span className="text-white font-extrabold text-lg leading-none tracking-tight" aria-hidden="true">
          P
        </span>
      </button>
    </div>
  );
}
