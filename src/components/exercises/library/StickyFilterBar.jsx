import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import CategoryChip from './CategoryChip';
import { EXERCISE_CATEGORIES } from '../../../utils/exerciseCategories';

export default function StickyFilterBar({
  search,
  onSearchChange,
  categories,
  onToggleCategory,
  onOpenSheet,
  activeFilterCount,
  categoryCounts,
}) {
  return (
    <div className="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-sm -mx-6 sm:-mx-12 px-6 sm:px-12 pt-2 pb-3 border-b border-slate-200">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar ejercicio…"
            className="w-full border border-slate-300 rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          onClick={onOpenSheet}
          className="lg:hidden relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition"
        >
          <SlidersHorizontal size={15} aria-hidden="true" /> Filtros
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar lg:hidden snap-x snap-mandatory">
        {EXERCISE_CATEGORIES.map((cat) => (
          <div key={cat.id} className="snap-start shrink-0">
            <CategoryChip
              category={cat}
              active={categories.includes(cat.id)}
              count={categoryCounts?.[cat.id] || 0}
              onClick={() => onToggleCategory(cat.id)}
              size="sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
