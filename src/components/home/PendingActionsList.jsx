import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ClipboardList, Trophy, ArrowRight, CheckCircle2, Send, Cake } from 'lucide-react';
import { MONTHS } from './HomeComponents';

function ItemIcon({ type }) {
  if (type === 'result')
    return (
      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
        <Trophy size={18} className="text-amber-600" aria-hidden="true" />
      </div>
    );
  if (type === 'convocatoria')
    return (
      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
        <Send size={18} className="text-blue-700" aria-hidden="true" />
      </div>
    );
  if (type === 'cumpleaños')
    return (
      <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
        <Cake size={18} className="text-rose-600" aria-hidden="true" />
      </div>
    );
  return (
    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
      <ClipboardList size={18} className="text-blue-600" aria-hidden="true" />
    </div>
  );
}

function DateChip({ session, severity }) {
  if (!session?.fecha) return null;
  const month = MONTHS[parseInt(session.fecha.split('-')[1]) - 1];
  const day = parseInt(session.fecha.split('-')[2]);
  const tone =
    severity === 'high' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200';
  return (
    <div
      className={`flex flex-col items-center justify-center w-11 h-11 rounded-lg text-[10px] font-bold uppercase border ${tone}`}
    >
      <span>{month}</span>
      <span className="text-sm leading-none font-black">{day}</span>
    </div>
  );
}

export default function PendingActionsList({
  items,
  total,
  onAction,
  creatingId,
  overflowHref = '/area-privada/pendientes',
}) {
  const overflow = Math.max(0, (total ?? items.length) - items.length);
  return (
    <section aria-label="Acciones pendientes" className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <header className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <AlertCircle size={15} className="text-amber-500" aria-hidden="true" />
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Pendientes</h3>
        <span className="ml-auto text-[11px] font-bold text-slate-400">
          {(total ?? items.length) > 0 ? `${total ?? items.length}` : ''}
        </span>
      </header>
      {items.length === 0 ? (
        <div className="px-4 py-6 flex items-center gap-3 text-slate-500 text-sm">
          <CheckCircle2 size={20} className="text-emerald-500 shrink-0" aria-hidden="true" />
          <p>Todo al día. Nada pendiente por hacer.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              {item.session && <DateChip session={item.session} severity={item.severity} />}
              <ItemIcon type={item.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{item.label}</p>
                <p className="text-xs text-slate-500 truncate">
                  {item.session?.teamName || item.team?.teamName || ''}
                  {item.session?.horaInicio ? ` · ${item.session.horaInicio}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAction?.(item)}
                disabled={creatingId === item.session?.id}
                className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition disabled:opacity-60"
              >
                {creatingId === item.session?.id ? (
                  '...'
                ) : (
                  <>
                    <ArrowRight size={12} aria-hidden="true" /> <span className="hidden sm:inline">{item.cta}</span>
                  </>
                )}
              </button>
            </li>
          ))}
          {overflow > 0 && (
            <li className="px-4 py-2 text-center">
              <Link
                to={overflowHref}
                className="text-sm font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
              >
                +{overflow} más
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
