import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Trophy, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/ayuda', label: 'Centro de ayuda', end: false },
];

function navLinkClass({ isActive }) {
  return [
    'text-sm font-medium transition-colors',
    isActive ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900',
  ].join(' ');
}

export default function PublicNavbar() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const ctaTo = user ? '/area-privada' : '/login';
  const ctaLabel = user ? 'Mi área privada' : 'Iniciar sesión';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Pick&Coach — Inicio">
            <Trophy size={24} className="text-amber-500" aria-hidden="true" />
            <span className="text-lg font-bold text-slate-900">Pick&amp;Coach</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8" aria-label="Principal">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center">
            <Link
              to={ctaTo}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {ctaLabel}
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <Link
              to={ctaTo}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {ctaLabel}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileOpen}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden pb-3 flex flex-col gap-1" aria-label="Principal móvil">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  [
                    'px-3 py-2 rounded-lg text-sm font-medium',
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
