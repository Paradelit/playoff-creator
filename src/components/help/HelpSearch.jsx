import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

const DEBOUNCE_MS = 150;
const MIN_QUERY = 2;

export default function HelpSearch({ query, onChange, onSearch, autoFocus = false }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < MIN_QUERY) return undefined;
    timerRef.current = setTimeout(() => {
      onSearch(query.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, onSearch]);

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search size={20} className="text-slate-400" aria-hidden="true" />
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar en el centro de ayuda…"
        autoFocus={autoFocus}
        className="w-full pl-12 pr-4 py-4 text-lg bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        aria-label="Buscar en el centro de ayuda"
      />
    </div>
  );
}
