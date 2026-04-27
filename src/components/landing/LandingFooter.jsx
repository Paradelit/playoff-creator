import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-100 py-10 text-slate-600 transition-colors dark:border-white/10 dark:bg-[#06060f] dark:text-slate-500">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-orange-400" aria-hidden="true" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">Pick&amp;Coach</span>
          </div>
          <nav className="flex gap-6 text-sm">
            <Link to="/ayuda" className="transition-colors hover:text-slate-900 dark:hover:text-slate-200">
              Centro de ayuda
            </Link>
            <Link to="/login" className="transition-colors hover:text-slate-900 dark:hover:text-slate-200">
              Iniciar sesión
            </Link>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} Pick&amp;Coach</p>
        </div>
      </div>
    </footer>
  );
}
