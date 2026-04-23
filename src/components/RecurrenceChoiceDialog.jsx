import React, { useId } from 'react';
import { Repeat, CalendarDays } from 'lucide-react';
import Dialog from './Dialog';

/**
 * Modal dialog for recurring session edit/delete actions.
 *
 * Props:
 *  - open: boolean
 *  - mode: 'edit' | 'delete'
 *  - onChoice: (choice: 'single' | 'thisAndFuture' | null) => void
 */
export default function RecurrenceChoiceDialog({ open, mode = 'edit', onChoice }) {
  const titleId = useId();
  const descId = useId();

  const isDelete = mode === 'delete';
  const title = isDelete ? '¿Eliminar sesión recurrente?' : 'Editar sesión recurrente';
  const message = isDelete
    ? 'Esta sesión forma parte de un grupo semanal. ¿Qué quieres eliminar?'
    : 'Esta sesión forma parte de un grupo semanal. ¿Cómo quieres aplicar los cambios?';

  return (
    <Dialog open={open} onClose={() => onChoice(null)} labelledBy={titleId} describedBy={descId}>
      <h2 id={titleId} className="font-semibold text-slate-900 text-lg mb-1">
        {title}
      </h2>
      <p id={descId} className="text-slate-600 text-sm mb-5">
        {message}
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onChoice('single')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          <CalendarDays size={18} className="text-slate-500 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-slate-800">Solo esta sesión</p>
            <p className="text-xs text-slate-500">
              {isDelete ? 'Elimina únicamente esta fecha' : 'Cambia solo esta fecha concreta'}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onChoice('thisAndFuture')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            isDelete
              ? 'border-red-200 hover:bg-red-50 focus-visible:ring-red-400'
              : 'border-blue-200 hover:bg-blue-50 focus-visible:ring-blue-400'
          }`}
        >
          <Repeat size={18} className={`shrink-0 ${isDelete ? 'text-red-500' : 'text-blue-500'}`} aria-hidden="true" />
          <div>
            <p className={`text-sm font-medium ${isDelete ? 'text-red-700' : 'text-blue-700'}`}>
              Esta y las siguientes
            </p>
            <p className="text-xs text-slate-500">
              {isDelete
                ? 'Elimina esta y todas las sesiones futuras del grupo'
                : 'Aplica el cambio a esta y todas las sesiones futuras'}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onChoice(null)}
          className="w-full px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition mt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded-lg"
        >
          Cancelar
        </button>
      </div>
    </Dialog>
  );
}
