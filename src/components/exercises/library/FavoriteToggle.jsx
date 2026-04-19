import React, { useState } from 'react';
import { Star } from 'lucide-react';

export default function FavoriteToggle({ active, onToggle, size = 16, className = '' }) {
  const [pending, setPending] = useState(false);

  async function handleClick(e) {
    e.stopPropagation();
    if (pending || !onToggle) return;
    setPending(true);
    try {
      await onToggle();
    } finally {
      setPending(false);
    }
  }

  const base = 'p-1.5 rounded-full transition-colors disabled:opacity-60';
  const activeCls = active
    ? 'text-amber-500 hover:bg-amber-50'
    : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100';

  return (
    <button
      type="button"
      aria-pressed={!!active}
      aria-label={active ? 'Quitar de favoritos' : 'Marcar como favorito'}
      onClick={handleClick}
      disabled={pending}
      className={`${base} ${activeCls} ${className}`}
    >
      <Star size={size} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}
