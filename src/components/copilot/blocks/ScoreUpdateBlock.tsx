import React from 'react';
import { Target } from 'lucide-react';
import type { ScoreUpdateEntry } from '../../../services/contentBlocks';

export default function ScoreUpdateBlock({ updates }: { updates: ScoreUpdateEntry[] }) {
  if (!updates.length) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white overflow-hidden">
      <div className="px-3 py-2 bg-emerald-100/60 border-b border-emerald-200 flex items-center gap-2">
        <Target size={14} className="text-emerald-700" />
        <p className="text-sm font-semibold text-emerald-900">Resultados detectados ({updates.length})</p>
      </div>
      <ul className="divide-y divide-emerald-100">
        {updates.map((u) => (
          <li key={u.id} className="px-3 py-2">
            <p className="text-[11px] text-slate-500 font-mono">{u.id}</p>
            <p className="text-xs text-slate-700 mt-0.5">
              {u.scores.map((s, i) => {
                const scr = s as { teamA?: number; teamB?: number };
                return (
                  <span key={i} className="inline-block mr-2">
                    J{i + 1}: <span className="font-semibold">{scr.teamA ?? '?'}</span>
                    <span className="text-slate-400"> – </span>
                    <span className="font-semibold">{scr.teamB ?? '?'}</span>
                  </span>
                );
              })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
