import React, { useId } from 'react';
import { X, Star } from 'lucide-react';
import CategoryChip from './CategoryChip';
import { EXERCISE_CATEGORIES, EXERCISE_PHASES, DIFFICULTY_LEVELS } from '../../../utils/exerciseCategories';
import Dialog from '../../Dialog';

export default function FilterSheet({
  open,
  onClose,
  filters,
  onToggleCategory,
  onSetFilter,
  onReset,
  hasActiveFilters,
  categoryCounts,
}) {
  const titleId = useId();
  const favId = useId();

  if (!open) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 z-[100] lg:hidden bg-slate-900/60 backdrop-blur-sm flex items-end"
      panelClassName="w-full bg-white rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 outline-none"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 id={titleId} className="text-lg font-bold text-slate-800">
          Filtros
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          aria-label="Cerrar"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <section aria-labelledby={`${titleId}-cat`} className="mb-5">
        <h3 id={`${titleId}-cat`} className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Categorías
        </h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
          {EXERCISE_CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.id}
              category={cat}
              active={filters.categories.includes(cat.id)}
              count={categoryCounts?.[cat.id] || 0}
              onClick={() => onToggleCategory(cat.id)}
              size="sm"
            />
          ))}
        </div>
      </section>

      <section aria-labelledby={`${titleId}-phase`} className="mb-5">
        <h3 id={`${titleId}-phase`} className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Fase
        </h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por fase">
          {EXERCISE_PHASES.map((p) => {
            const active = filters.phase === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSetFilter('phase', active ? null : p.id)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ${
                  active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby={`${titleId}-diff`} className="mb-5">
        <h3 id={`${titleId}-diff`} className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          Dificultad
        </h3>
        <div className="flex gap-2" role="group" aria-label="Filtrar por dificultad">
          {DIFFICULTY_LEVELS.map((lvl) => {
            const active = filters.difficulty === lvl;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onSetFilter('difficulty', active ? null : lvl)}
                aria-pressed={active}
                aria-label={`Dificultad ${lvl}`}
                className={`w-11 h-11 rounded-xl text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ${
                  active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {lvl}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <label
          htmlFor={favId}
          className="flex items-center gap-3 cursor-pointer select-none text-slate-700 p-3 rounded-xl bg-slate-50"
        >
          <input
            id={favId}
            type="checkbox"
            checked={!!filters.favoritesOnly}
            onChange={(e) => onSetFilter('favoritesOnly', e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
          />
          <Star size={16} className="text-amber-500" fill="currentColor" aria-hidden="true" />
          <span className="font-semibold text-sm">Solo favoritos</span>
        </label>
      </section>

      <div className="flex gap-2 sticky bottom-0 bg-white pt-2">
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="flex-1 py-3 rounded-xl font-bold text-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            Limpiar
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
        >
          Aplicar
        </button>
      </div>
    </Dialog>
  );
}
