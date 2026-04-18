import React from 'react';
import { BookOpen, ChevronRight, Plus } from 'lucide-react';

function exerciseSummary(ex) {
  if (Array.isArray(ex.tags) && ex.tags.length > 0) return ex.tags.slice(0, 3).join(' · ');
  if (ex.contenido) return ex.contenido;
  if (ex.categoria) return ex.categoria;
  return 'Ejercicio';
}

export default function BibliotecaPreview({ exercises, totalCount, navigate }) {
  const hasAny = exercises.length > 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => navigate('/exercises')}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
          <BookOpen size={18} className="text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">Biblioteca de ejercicios</p>
          <p className="text-xs text-slate-500">
            {totalCount > 0 ? `${totalCount} ${totalCount === 1 ? 'ejercicio' : 'ejercicios'}` : 'Vacía'}
          </p>
        </div>
        <ChevronRight size={16} className="text-slate-400 shrink-0" />
      </button>

      {hasAny ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {exercises.map((ex) => (
            <li key={ex.id}>
              <button
                onClick={() => navigate('/exercises')}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{ex.nombre || 'Ejercicio sin nombre'}</p>
                  <p className="text-xs text-slate-500 truncate">{exerciseSummary(ex)}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-t border-slate-100 px-4 py-4 flex items-center gap-3">
          <p className="text-xs text-slate-500 flex-1">Aún no has añadido ejercicios. Empieza creando el primero.</p>
          <button
            onClick={() => navigate('/exercises')}
            className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
          >
            <Plus size={14} /> Crear
          </button>
        </div>
      )}
    </div>
  );
}
