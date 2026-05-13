import React from 'react';
import { Pencil, Trash2, User } from 'lucide-react';

/**
 * Fila de miembro (jugador o staff) en el listado de un team. Extraído de
 * TeamDetailScreen para mantener el screen padre <500 LOC.
 */
export default function MemberRow({ primary, secondary, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
        <User size={15} className="text-slate-500" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm truncate">{primary}</p>
        <p className="text-xs text-slate-500 truncate">{secondary}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors"
          title="Editar"
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
          title="Eliminar"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
