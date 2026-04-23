import React from 'react';
import { CalendarDays } from 'lucide-react';

function DotRow({ counts }) {
  const dots = [];
  for (let i = 0; i < Math.min(counts.entrenamiento, 3); i++) {
    dots.push(<span key={`t${i}`} className="w-1.5 h-1.5 rounded-full bg-blue-500" />);
  }
  for (let i = 0; i < Math.min(counts.partido, 3); i++) {
    dots.push(<span key={`m${i}`} className="w-1.5 h-1.5 rounded-full bg-rose-500" />);
  }
  for (let i = 0; i < Math.min(counts.playoff, 3); i++) {
    dots.push(<span key={`p${i}`} className="w-1.5 h-1.5 rounded-full bg-amber-500" />);
  }
  if (dots.length === 0) {
    return <span className="w-1.5 h-1.5 rounded-full bg-slate-200" aria-hidden />;
  }
  return <div className="flex gap-0.5 flex-wrap justify-center items-center">{dots.slice(0, 5)}</div>;
}

export default function WeekStrip({ days, navigate }) {
  return (
    <section aria-label="Resumen semanal" className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <header className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <CalendarDays size={15} className="text-slate-400" aria-hidden="true" />
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Esta semana</h3>
        <button
          type="button"
          onClick={() => navigate?.('/calendar')}
          className="ml-auto text-[11px] font-bold text-blue-600 hover:text-blue-700 transition"
        >
          Ver calendario →
        </button>
      </header>
      <div className="grid grid-cols-7 px-2 py-3">
        {days.map((d) => (
          <button
            key={d.ymd}
            onClick={() => navigate?.(`/calendar?date=${d.ymd}`)}
            className={`flex flex-col items-center py-2 rounded-lg transition ${
              d.isToday ? 'bg-amber-50' : 'hover:bg-slate-50'
            }`}
            title={d.ymd}
          >
            <span className={`text-[10px] font-bold uppercase ${d.isToday ? 'text-amber-700' : 'text-slate-400'}`}>
              {d.label}
            </span>
            <span
              className={`mt-0.5 text-sm font-black w-7 h-7 rounded-full flex items-center justify-center ${
                d.isToday ? 'bg-amber-400 text-white' : d.isPast ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              {d.dayNum}
            </span>
            <div className="mt-1.5 h-2 flex items-center">
              <DotRow counts={d.counts} />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
