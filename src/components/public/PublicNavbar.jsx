import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Trophy, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/ayuda', label: 'Centro de ayuda', end: false },
];

export default function PublicNavbar() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const isLanding = location.pathname === '/';

  useEffect(() => {
    if (!isLanding) return undefined;
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isLanding]);

  const ctaTo = user ? '/area-privada' : '/login';
  const ctaLabel = user ? 'Mi área' : 'Entrar';

  const dark = isLanding && !scrolled;

  return (
    <header
      className="sticky top-0 z-40 transition-all duration-300"
      style={{
        background: dark ? 'rgba(6,6,15,.7)' : 'rgba(6,6,15,.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: dark ? '1px solid rgba(255,255,255,.04)' : '1px solid rgba(255,255,255,.08)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: '3.75rem' }}>
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Pick&Coach — Inicio">
            <Trophy size={22} className="text-orange-400" aria-hidden="true" />
            <span className="text-base font-extrabold text-white tracking-tight">Pick&amp;Coach</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8" aria-label="Principal">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  [
                    'text-sm font-medium transition-colors',
                    isActive ? 'text-orange-400' : 'text-slate-400 hover:text-white',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center">
            <Link
              to={ctaTo}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-[1.03] active:scale-100"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff' }}
            >
              {ctaLabel}
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <Link
              to={ctaTo}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff' }}
            >
              {ctaLabel}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileOpen}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden pb-4 flex flex-col gap-1 border-t border-white/10 pt-3" aria-label="Principal móvil">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  [
                    'px-3 py-2 rounded-lg text-sm font-medium',
                    isActive ? 'bg-orange-500/20 text-orange-300' : 'text-slate-300 hover:bg-white/10 hover:text-white',
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
