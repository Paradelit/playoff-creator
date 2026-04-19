import React from 'react';

export default function CategoryChip({ category, active, count, onClick, size = 'md' }) {
  const px = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  const base = `inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors whitespace-nowrap ${px}`;
  const tone = active
    ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
    : 'bg-slate-100 text-slate-700 hover:bg-slate-200';

  return (
    <button type="button" onClick={onClick} aria-pressed={!!active} className={`${base} ${tone}`}>
      <span aria-hidden="true">{category.emoji}</span>
      <span>{category.label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            active ? 'bg-indigo-500/60 text-white' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
