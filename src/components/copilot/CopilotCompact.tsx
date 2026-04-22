import React from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, X } from 'lucide-react';
import { useCopilot } from '../../contexts/CopilotProvider';

interface Props {
  animating?: boolean;
}

export default function CopilotCompact({ animating }: Props) {
  const { setMode, currentTip, dismissTip } = useCopilot();

  return (
    <div className={`fixed bottom-20 right-4 z-50 flex items-end gap-2 ${animating ? 'animate-copilot-collapse' : ''}`}>
      {/* Speech bubble */}
      {currentTip && !animating && (
        <div className="animate-copilot-fade-in flex items-center gap-2 bg-white shadow-lg rounded-xl px-3.5 py-2.5 max-w-[220px] border border-slate-200">
          <button
            onClick={() => setMode('panel')}
            className="text-sm text-slate-700 font-medium text-left flex-1 leading-snug"
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="text-sm text-slate-700 font-medium text-left flex-1 leading-snug">{children}</p>
                ),
                strong: ({ children }) => <strong className="font-bold text-blue-700">{children}</strong>,
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
          {/* Triangle pointing right to the button */}
          <div className="absolute -right-1.5 bottom-3.5 w-3 h-3 bg-white border-r border-b border-slate-200 rotate-[-45deg]" />
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setMode('panel')}
        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-full shadow-lg flex items-center justify-center transition-colors shrink-0"
        aria-label="Abrir copilot"
      >
        <MessageCircle size={22} className="text-white" />
      </button>
    </div>
  );
}
