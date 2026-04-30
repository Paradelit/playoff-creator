import React from 'react';
import { toYMD } from '../../utils/dateUtils';
import { TEAM_COLORS, teamColorIndex, DAY_HEADERS } from '../../utils/constants';

export function buildCalendarDays(currentMonth, sessions) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const sessionsByDate = {};
  sessions.forEach((s) => {
    if (!sessionsByDate[s.fecha]) sessionsByDate[s.fecha] = [];
    sessionsByDate[s.fecha].push(s);
  });

  const days = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false, sessions: sessionsByDate[toYMD(d)] || [] });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({ date, isCurrentMonth: true, sessions: sessionsByDate[toYMD(date)] || [] });
  }
  const total = days.length <= 35 ? 35 : 42;
  let nextDay = 1;
  while (days.length < total) {
    const date = new Date(year, month + 1, nextDay++);
    days.push({ date, isCurrentMonth: false, sessions: sessionsByDate[toYMD(date)] || [] });
  }
  return days;
}

export default function MonthGrid({ calendarDays, todayYMD, loading, onSelectSession, getTrainingNum }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center py-2 text-xs font-bold text-slate-500">
            {d}
          </div>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, isCurrentMonth, sessions: daySessions }, idx) => {
            const ymd = toYMD(date);
            const isToday = ymd === todayYMD;
            return (
              <div
                key={idx}
                className={`min-h-[72px] sm:min-h-[88px] border-b border-r border-slate-100 p-1.5 ${!isCurrentMonth ? 'opacity-40 bg-slate-50' : ''}`}
              >
                <div className="mb-1">
                  <span
                    className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-amber-400 text-slate-900 font-bold' : 'text-slate-600 font-semibold'}`}
                  >
                    {date.getDate()}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {daySessions.map((s) => {
                    const isPartido = s.tipo === 'partido';
                    const isPlayoff = s.tipo === 'playoff';
                    return (
                      <button
                        key={s.id}
                        onClick={() => onSelectSession(s)}
                        className={`w-full text-left rounded px-1.5 py-0.5 text-xs font-semibold truncate transition-opacity hover:opacity-80 ${isPlayoff ? 'bg-amber-500 text-white' : isPartido ? 'bg-rose-500 text-white' : TEAM_COLORS[teamColorIndex(s.teamId)]}`}
                        title={
                          isPlayoff
                            ? `${s.teamName} Torneo vs ${s.rival}`
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
      )}
    </div>
  );
}
