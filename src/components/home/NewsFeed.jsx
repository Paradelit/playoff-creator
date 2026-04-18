import React from 'react';
import { Sparkles, ClipboardList, Trophy, BookOpen, Swords } from 'lucide-react';
import { relativeTime } from '../../utils/homeUtils';

const KIND_STYLES = {
  training_created: { Icon: ClipboardList, bg: 'bg-blue-100', color: 'text-blue-600' },
  exercise_added: { Icon: BookOpen, bg: 'bg-rose-100', color: 'text-rose-600' },
  match_played: { Icon: Swords, bg: 'bg-emerald-100', color: 'text-emerald-600' },
  bracket_progress: { Icon: Trophy, bg: 'bg-amber-100', color: 'text-amber-600' },
};

export default function NewsFeed({ items, navigate, now }) {
  const nowRef = now || new Date();
  return (
    <section aria-label="Novedades" className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <header className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Sparkles size={15} className="text-slate-400" />
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Novedades</h3>
      </header>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">Sin actividad reciente.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((it) => {
            const style = KIND_STYLES[it.kind] || KIND_STYLES.training_created;
            const { Icon } = style;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => it.navigateTo && navigate?.(it.navigateTo)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${style.bg}`}>
                    <Icon size={16} className={style.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{it.title}</p>
                    {it.subtitle && <p className="text-xs text-slate-500 truncate">{it.subtitle}</p>}
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400 font-medium">{relativeTime(it.ts, nowRef)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
