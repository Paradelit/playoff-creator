import React, { useId } from 'react';
import { X, Cake } from 'lucide-react';
import Dialog from '../Dialog';

const SEEN_KEY = (memberId, year) => `cumpleanosSeen-${memberId}-${year}`;

export default function CumpleañosModal({ item, onClose }) {
  const titleId = useId();
  const m = item?.member;

  if (!m) return null;

  function handleSeen() {
    try {
      localStorage.setItem(SEEN_KEY(m.id, new Date().getFullYear()), '1');
    } catch {
      // localStorage may be disabled in private mode; non-fatal.
    }
    onClose();
  }

  const sub =
    m.tipo === 'staff'
      ? `${item.team?.teamName || ''}${m.rol ? ` · ${m.rol}` : ''}`
      : `${item.team?.teamName || ''}${m.dorsal != null ? ` · #${m.dorsal}` : ''}`;

  const ageLabel = item.age != null ? `Cumple ${item.age} años.` : 'Cumpleaños hoy.';

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[120] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      panelClassName="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200 my-auto shrink-0"
    >
      <div className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0" aria-hidden="true">
          <Cake size={20} className="text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 id={titleId} className="font-bold text-slate-800 truncate">
            {item.label}
          </h3>
          {sub && <p className="text-xs text-slate-500 truncate">{sub}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-slate-700">{ageLabel}</p>
      </div>
      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={handleSeen}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          Marcar como visto
        </button>
      </div>
    </Dialog>
  );
}
