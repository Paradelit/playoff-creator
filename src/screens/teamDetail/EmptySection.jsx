import React from 'react';
import { Users } from 'lucide-react';

/**
 * Empty state para listas vacías en TeamDetailScreen (sin jugadores, sin staff).
 */
export default function EmptySection({ text }) {
  return (
    <div className="flex items-center justify-center py-10 text-slate-400 text-sm gap-2">
      <Users size={16} aria-hidden="true" /> {text}
    </div>
  );
}
