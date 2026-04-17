import React from 'react';
import { Trophy } from 'lucide-react';
import type { BracketPreviewData } from '../../../services/contentBlocks';

export default function BracketPreviewBlock({ bracket }: { bracket: BracketPreviewData }) {
  const matches = Array.isArray(bracket.initialMatches) ? bracket.initialMatches : [];
  const rounds = Array.isArray(bracket.rounds) ? bracket.rounds : [];
  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white overflow-hidden">
      <div className="px-3 py-2 bg-amber-100/60 border-b border-amber-200 flex items-center gap-2">
        <Trophy size={14} className="text-amber-600" />
        <p className="text-sm font-semibold text-amber-900 truncate flex-1">
          {bracket.tournamentName || 'Cuadro del torneo'}
        </p>
      </div>
      <div className="px-3 py-2 space-y-1">
        <p className="text-xs text-slate-600">
          <span className="font-semibold">{matches.length}</span> enfrentamientos iniciales
          {rounds.length > 0 && ` · ${rounds.length} rondas`}
        </p>
        {matches.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {matches.slice(0, 4).map((m, i) => {
              const match = m as { teamA?: string; teamB?: string };
              return (
                <li
                  key={i}
                  className="text-xs text-slate-700 bg-white rounded-md px-2 py-1 border border-amber-100 flex items-center justify-between"
                >
                  <span className="font-medium truncate">{match.teamA || '?'}</span>
                  <span className="text-amber-600 text-[10px] font-bold px-2">VS</span>
                  <span className="font-medium truncate">{match.teamB || '?'}</span>
                </li>
              );
            })}
            {matches.length > 4 && <li className="text-[11px] text-slate-400 italic">… y {matches.length - 4} más</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
