import React from 'react';
import { Users, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TeamListEntry } from '../../../services/contentBlocks';

export default function TeamListBlock({ teams }: { teams: TeamListEntry[] }) {
  const navigate = useNavigate();
  if (!teams.length) {
    return <p className="text-xs text-slate-500 italic">No hay equipos.</p>;
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
        <Users size={12} /> Equipos ({teams.length})
      </div>
      <ul className="divide-y divide-slate-100">
        {teams.map((team) => (
          <li key={team.id}>
            <button
              type="button"
              onClick={() => navigate(`/teams/${team.id}`)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{team.name}</p>
                <p className="text-[11px] text-slate-500">
                  {team.categoria || 'sin categoría'} · {team.memberCount} miembros
                </p>
              </div>
              <ChevronRight size={14} className="text-slate-400 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
