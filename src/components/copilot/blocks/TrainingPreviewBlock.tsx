import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Dumbbell, Clock } from 'lucide-react';
import type { TrainingPreviewData } from '../../../services/contentBlocks';

export default function TrainingPreviewBlock({ training }: { training: TrainingPreviewData }) {
  const blocks = Array.isArray(training.mainBlocks) ? training.mainBlocks : [];
  return (
    <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white overflow-hidden">
      <div className="px-3 py-2 bg-orange-100/60 border-b border-orange-200 flex items-center gap-2">
        <Dumbbell size={14} className="text-orange-600" />
        <p className="text-sm font-semibold text-orange-900 truncate flex-1">{training.title}</p>
        <span className="inline-flex items-center gap-1 text-[11px] text-orange-700 font-medium">
          <Clock size={10} />
          {training.totalDuration}m
        </span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {training.warmup ? (
          <div className="text-xs">
            <span className="font-semibold text-slate-700">Calentamiento:</span>{' '}
            <span className="text-slate-600">{summarize(training.warmup)}</span>
          </div>
        ) : null}
        {blocks.length > 0 && (
          <div className="text-xs">
            <span className="font-semibold text-slate-700">Bloques principales ({blocks.length}):</span>
            <ul className="mt-1 space-y-0.5 pl-2">
              {blocks.slice(0, 4).map((b, i) => (
                <li key={i} className="text-slate-600 truncate">
                  · {summarize(b)}
                </li>
              ))}
              {blocks.length > 4 && <li className="text-slate-400 italic">… y {blocks.length - 4} más</li>}
            </ul>
          </div>
        )}
        {training.cooldown ? (
          <div className="text-xs">
            <span className="font-semibold text-slate-700">Vuelta a la calma:</span>{' '}
            <span className="text-slate-600">{summarize(training.cooldown)}</span>
          </div>
        ) : null}
        {training.notes && (
          <div className="text-[11px] text-slate-500 italic mt-1">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p>{children}</p>,
                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
              }}
            >
              {training.notes}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function summarize(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as { title?: string; name?: string; description?: string; duration?: number };
    const parts: string[] = [];
    if (obj.title || obj.name) parts.push(String(obj.title || obj.name));
    if (obj.duration) parts.push(`${obj.duration}m`);
    return parts.length ? parts.join(' · ') : JSON.stringify(val).slice(0, 60);
  }
  return String(val);
}
