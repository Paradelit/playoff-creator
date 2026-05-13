import React from 'react';
import { Bell, AlertTriangle, Info } from 'lucide-react';
import type { ProactiveMessage, ProactiveKind } from '../../../services/aiClient';

export interface ProactiveCardProps {
  message: ProactiveMessage;
  /** Called when the coach accepts the CTA. Receives the suggestedPrompt to fire. */
  onAccept: (suggestedPrompt: string) => void;
  /** Called when the coach clicks "Ahora no". Receives the kind to record dismissal. */
  onDismiss: (kind: ProactiveKind) => void;
}

const STYLE_BY_SEVERITY: Record<'info' | 'warn' | 'high', { border: string; bg: string; icon: string; title: string }> =
  {
    high: {
      border: 'border-amber-300',
      bg: 'bg-amber-50/80',
      icon: 'text-amber-700',
      title: 'text-amber-900',
    },
    warn: {
      border: 'border-yellow-200',
      bg: 'bg-yellow-50/60',
      icon: 'text-yellow-700',
      title: 'text-yellow-900',
    },
    info: {
      border: 'border-slate-200',
      bg: 'bg-slate-50',
      icon: 'text-slate-600',
      title: 'text-slate-800',
    },
  };

function SeverityIcon({ severity, className }: { severity: 'info' | 'warn' | 'high'; className?: string }) {
  if (severity === 'high') return <AlertTriangle size={14} className={className} />;
  if (severity === 'warn') return <Bell size={14} className={className} />;
  return <Info size={14} className={className} />;
}

export default function ProactiveCard({ message, onAccept, onDismiss }: ProactiveCardProps) {
  const style = STYLE_BY_SEVERITY[message.severity];
  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
      <div className={`px-3 py-2 border-b ${style.border} flex items-center gap-2`}>
        <SeverityIcon severity={message.severity} className={style.icon} />
        <p className={`text-xs font-semibold uppercase tracking-wide ${style.title}`}>Pick te avisa</p>
      </div>
      <div className="px-3 py-2 space-y-2">
        <p className="text-sm text-slate-800">{message.text}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {message.suggestedPrompt && (
            <button
              type="button"
              onClick={() => onAccept(message.suggestedPrompt!)}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
            >
              Sí, hagámoslo
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(message.kind)}
            className="inline-flex items-center px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
