import React from 'react';
import { Star } from 'lucide-react';
import CategoryChip from './CategoryChip';
import { EXERCISE_CATEGORIES, EXERCISE_PHASES, DIFFICULTY_LEVELS } from '../../../utils/exerciseCategories';

function FilterSection({ title, children }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}

export default function FilterSidebar({
  filters,
  onToggleCategory,
  onSetFilter,
  onReset,
  hasActiveFilters,
  categoryCounts,
}) {
  return (
    <aside className="hidden lg:block w-60 shrink-0 sticky top-28 self-start">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">Filtros</h2>
          {hasActiveFilters && (
            <button onClick={onReset} className="text-[11px] font-semibold text-red-500 hover:text-red-700">
              Limpiar
            </button>
          )}
        </div>

        <FilterSection title="Categorías">
          <div className="flex flex-wrap gap-1.5">
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
        </FilterSection>

        <FilterSection title="Fase">
          <div className="flex flex-wrap gap-1.5">
            {EXERCISE_PHASES.map((p) => {
              const active = filters.phase === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSetFilter('phase', active ? null : p.id)}
                  aria-pressed={active}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection title="Dificultad">
          <div className="flex gap-1">
            {DIFFICULTY_LEVELS.map((lvl) => {
              const active = filters.difficulty === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => onSetFilter('difficulty', active ? null : lvl)}
                  aria-pressed={active}
                  aria-label={`Dificultad ${lvl}`}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                    active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection title="Otros">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!!filters.favoritesOnly}
              onChange={(e) => onSetFilter('favoritesOnly', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
            />
            <Star size={14} className="text-amber-500" fill="currentColor" aria-hidden="true" />
            Solo favoritos
          </label>
        </FilterSection>
      </div>
    </aside>
  );
}
