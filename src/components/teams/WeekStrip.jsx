import React from 'react';
import { DAY_HEADERS } from '../../utils/constants';
import { toYMD } from '../../utils/dateUtils';

function mondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dotColor(tipo) {
  if (tipo === 'partido') return 'bg-rose-500';
  if (tipo === 'playoff') return 'bg-amber-500';
  return 'bg-blue-500';
}

export default function WeekStrip({ teamId, sessions, onDayClick }) {
  const monday = mondayOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const todayYMD = toYMD(new Date());
  const byDay = {};
  for (const s of sessions) {
    if (teamId && s.teamId !== teamId) continue;
    if (!byDay[s.fecha]) byDay[s.fecha] = [];
    byDay[s.fecha].push(s);
  }

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d, i) => {
        const ymd = toYMD(d);
        const sess = byDay[ymd] || [];
        const isToday = ymd === todayYMD;
        return (
          <button
            key={ymd}
            type="button"
            onClick={() => onDayClick?.(ymd)}
            className={`flex flex-col items-center gap-1 py-2 rounded-lg transition ${
              isToday ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase">{DAY_HEADERS[i]}</span>
            <span className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>{d.getDate()}</span>
            <div className="flex gap-0.5 min-h-[6px]">
              {sess.slice(0, 3).map((s) => (
                <span key={s.id} className={`w-1.5 h-1.5 rounded-full ${dotColor(s.tipo)}`} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
