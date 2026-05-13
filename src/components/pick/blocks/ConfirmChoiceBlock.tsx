import React from 'react';
import { HelpCircle } from 'lucide-react';
import type { AmbiguityCandidate } from '../../../services/contentBlocks';

export interface ConfirmChoiceBlockProps {
  prompt: string;
  candidates: AmbiguityCandidate[];
  intent: string;
  onPick: (candidate: AmbiguityCandidate, intent: string) => void;
}

/**
 * Render del bloque `confirm_choice` que emite el orchestrator cuando detecta
 * que el mensaje del coach tiene >1 referente plausible (sub-B.3).
 *
 * Al elegir una opción, dispara `onPick(candidate, intent)` — el hook padre
 * decide cómo continuar (típicamente: re-enviar un mensaje con la elección
 * incrustada para que el LLM tenga contexto completo).
 */
export default function ConfirmChoiceBlock({ prompt, candidates, intent, onPick }: ConfirmChoiceBlockProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
      <div className="px-3 py-2 border-b border-amber-200 flex items-center gap-2">
        <HelpCircle size={14} className="text-amber-600" />
        <p className="text-sm font-semibold text-amber-900">Pick necesita aclarar algo</p>
      </div>
      <div className="px-3 py-2 space-y-2">
        <p className="text-sm text-slate-800">{prompt}</p>
        {candidates.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c, intent)}
                className="inline-flex items-center px-3 py-1.5 bg-white hover:bg-amber-100 text-slate-800 text-xs font-medium rounded-lg border border-amber-200 transition"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
