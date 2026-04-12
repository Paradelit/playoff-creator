import React from 'react';
import { CalendarDays, ClipboardList, Trophy } from 'lucide-react';
import { TEAM_COLORS, teamColorIndex } from '../../utils/constants';

export default function DayView({ sessions, loading, onSelectSession, getTrainingNum }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
        <CalendarDays size={40} className="mb-3 text-slate-300" />
        <p className="text-sm font-medium">No hay sesiones este día</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden divide-y divide-slate-100">
      {sessions.map((s) => {
        const isPartido = s.tipo === 'partido';
        const isPlayoff = s.tipo === 'playoff';
        const colorClass = TEAM_COLORS[teamColorIndex(s.teamId)].split(' ')[0];
        return (
          <button
            key={s.id}
            onClick={() => onSelectSession(s)}
            className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPlayoff ? 'bg-amber-100' : isPartido ? 'bg-rose-100' : 'bg-blue-100'}`}
            >
              {isPlayoff ? (
                <Trophy size={18} className="text-amber-600" />
              ) : isPartido ? (
                <Trophy size={18} className="text-rose-600" />
              ) : (
                <ClipboardList size={18} className="text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate">
                {isPlayoff
                  ? `Playoff vs ${s.rival}`
                  : isPartido
                    ? `vs ${s.rival || 'Rival'}`
                    : `Entrenamiento #${getTrainingNum(s)}`}
              </p>
              <p className="text-xs text-slate-500">{s.teamName}</p>
              {s.horaInicio && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {s.horaInicio}
                  {s.horaFin ? ` – ${s.horaFin}` : ''}
                  {s.lugar ? ` · ${s.lugar}` : ''}
                </p>
              )}
            </div>
            <div className={`w-2 h-10 rounded-full shrink-0 ${colorClass}`} />
          </button>
        );
      })}
    </div>
  );
}
