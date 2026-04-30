import React from 'react';
import { toYMD } from '../../utils/dateUtils';
import { TEAM_COLORS, teamColorIndex, DAY_NAMES_SHORT } from '../../utils/constants';

export default function WeekView({ weekDays, todayYMD, loading, onSelectSession, getTrainingNum }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7">
        {weekDays.map(({ date, sessions: daySessions }) => {
          const ymd = toYMD(date);
          const isToday = ymd === todayYMD;
          const dow = date.getDay() === 0 ? 6 : date.getDay() - 1;
          return (
            <div key={ymd} className="border-r border-slate-100 last:border-r-0 flex flex-col">
              <div className={`text-center py-2 border-b border-slate-200 ${isToday ? 'bg-amber-50' : ''}`}>
                <p className="text-xs font-semibold text-slate-500">{DAY_NAMES_SHORT[dow]}</p>
                <span
                  className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mx-auto mt-0.5 ${isToday ? 'bg-amber-400 text-slate-900' : 'text-slate-700'}`}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-1 min-h-[120px]">
                {daySessions.map((s) => {
                  const isPartido = s.tipo === 'partido';
                  const isPlayoff = s.tipo === 'playoff';
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelectSession(s)}
                      className={`w-full text-left rounded px-1.5 py-1 text-xs font-semibold truncate transition-opacity hover:opacity-80 ${isPlayoff ? 'bg-amber-500 text-white' : isPartido ? 'bg-rose-500 text-white' : TEAM_COLORS[teamColorIndex(s.teamId)]}`}
                      title={
                        isPlayoff
                          ? `Torneo vs ${s.rival}`
                          : isPartido
                            ? `${s.teamName} vs ${s.rival || 'Rival'}`
                            : `${s.teamName} #${getTrainingNum(s)}`
                      }
                    >
                      {isPlayoff ? `PO vs ${s.rival}` : isPartido ? `vs ${s.rival || 'Rival'}` : s.teamName}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
