import React from 'react';
import { BookOpen, ChevronRight, Plus, Star, Clock, TrendingUp } from 'lucide-react';

function exerciseSummary(ex) {
  if (Array.isArray(ex.tags) && ex.tags.length > 0) return ex.tags.slice(0, 3).join(' · ');
  if (ex.contenido) return ex.contenido;
  if (ex.categoria) return ex.categoria;
  return 'Ejercicio';
}

function DiscoveryStrip({ insights, navigate }) {
  const favoritesCount = insights?.favorites?.length || 0;
  const recentlyCount = insights?.recentlyUsed?.length || 0;
  const trendingCount = insights?.trending?.length || 0;
  const anything = favoritesCount + recentlyCount + trendingCount > 0;
  if (!anything) return null;
  const base = 'inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 transition';
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 border-t border-slate-100 pt-2">
      {favoritesCount > 0 && (
        <button
          onClick={() => navigate('/exercises#favoritos')}
          className={`${base} bg-amber-50 text-amber-700 hover:bg-amber-100`}
        >
          <Star size={11} fill="currentColor" /> {favoritesCount} fav.
        </button>
      )}
      {recentlyCount > 0 && (
        <button
          onClick={() => navigate('/exercises#recien')}
          className={`${base} bg-blue-50 text-blue-700 hover:bg-blue-100`}
        >
          <Clock size={11} /> {recentlyCount} recientes
        </button>
      )}
      {trendingCount > 0 && (
        <button
          onClick={() => navigate('/exercises#tendencias')}
          className={`${base} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        >
          <TrendingUp size={11} /> {trendingCount} en tendencia
        </button>
      )}
    </div>
  );
}

export default function BibliotecaPreview({ exercises, totalCount, navigate, insights }) {
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
        <>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {exercises.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => navigate('/exercises')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {ex.nombre || 'Ejercicio sin nombre'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{exerciseSummary(ex)}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
          <DiscoveryStrip insights={insights} navigate={navigate} />
        </>
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
