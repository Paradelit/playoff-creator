// src/components/landing/LandingFooter.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-amber-400" aria-hidden="true" />
            <span className="text-white font-semibold">Pick&amp;Coach</span>
          </div>
          <nav className="flex gap-6 text-sm">
            <Link to="/ayuda" className="hover:text-white transition-colors">
              Centro de ayuda
            </Link>
            <Link to="/login" className="hover:text-white transition-colors">
              Iniciar sesión
            </Link>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} Pick&amp;Coach</p>
        </div>
      </div>
    </footer>
  );
}
