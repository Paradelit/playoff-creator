import React from 'react';
import { Sparkles } from 'lucide-react';
import { usePick } from '../../contexts/PickProvider';

interface Props {
  message: string;
  prompt: string;
  cta?: string;
  onDismiss?: () => void;
}

/**
 * Inline Pick hint that appears on screens where Pick can do real work
 * (Scouting, Análisis, ConvocatoriasTab, etc.). Tapping the CTA opens the Pick
 * panel pre-loaded with `prompt`. Lives in the surface flow, not as a modal,
 * so the screen still works without Pick.
 */
export default function PickHintBanner({ message, prompt, cta = 'Pídeselo a Pick', onDismiss }: Props) {
  const { sendMessage } = usePick();

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3 print:hidden">
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-sm"
        style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
        aria-hidden="true"
      >
        <span className="text-white font-extrabold text-sm leading-none">P</span>
      </div>
      <p className="text-sm text-slate-700 flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={() => sendMessage(prompt)}
        className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 inline-flex items-center gap-1.5"
      >
        <Sparkles size={12} aria-hidden="true" /> {cta}
      </button>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar sugerencia"
          className="text-slate-400 hover:text-slate-600 text-lg leading-none px-1 shrink-0"
        >
          ×
        </button>
      )}
    </div>
  );
}
