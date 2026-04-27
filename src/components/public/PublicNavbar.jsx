import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Trophy, Menu, X, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePublicTheme } from '../../hooks/usePublicTheme';

const NAV_LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/ayuda', label: 'Centro de ayuda', end: false },
];

export default function PublicNavbar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = usePublicTheme();
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

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const ctaTo = user ? '/area-privada' : '/login';
  const ctaLabel = user ? 'Mi área' : 'Entrar';
  const isDarkTheme = theme === 'dark';
  const transparentChrome = isLanding && !scrolled;
  const headerBg = transparentChrome
    ? isDarkTheme
      ? 'rgba(6,6,15,.7)'
      : 'rgba(255,255,255,.78)'
    : isDarkTheme
      ? 'rgba(6,6,15,.97)'
      : 'rgba(255,255,255,.94)';
  const headerBorder = transparentChrome
    ? isDarkTheme
      ? '1px solid rgba(255,255,255,.05)'
      : '1px solid rgba(148,163,184,.18)'
    : isDarkTheme
      ? '1px solid rgba(255,255,255,.08)'
      : '1px solid rgba(148,163,184,.22)';
  const brandTextClass = isDarkTheme ? 'text-white' : 'text-slate-900';
  const navIdleClass = isDarkTheme ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900';
  const toggleLabel = isDarkTheme ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  const toggleButtonClass = isDarkTheme
    ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100';
  const mobileButtonClass = isDarkTheme
    ? 'text-slate-400 hover:text-white hover:bg-white/10'
    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';
  const mobileNavClass = isDarkTheme ? 'border-white/10' : 'border-slate-200';
  const mobileLinkClass = isDarkTheme
    ? 'text-slate-300 hover:bg-white/10 hover:text-white'
    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900';
  const mobileActiveClass = isDarkTheme ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700';

  return (
    <header
      className="sticky top-0 z-40 transition-all duration-300"
      style={{
        background: headerBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: headerBorder,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: '3.75rem' }}>
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Pick&Coach — Inicio">
            <Trophy size={22} className="text-orange-400" aria-hidden="true" />
            <span className={`text-base font-extrabold tracking-tight ${brandTextClass}`}>Pick&amp;Coach</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Principal">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  ['text-sm font-medium transition-colors', isActive ? 'text-orange-400' : navIdleClass].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              role="switch"
              aria-checked={isDarkTheme}
              aria-label={toggleLabel}
              onClick={toggleTheme}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${toggleButtonClass}`}
            >
              {isDarkTheme ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              <span>{isDarkTheme ? 'Claro' : 'Oscuro'}</span>
            </button>
            <Link
              to={ctaTo}
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-bold transition-all hover:scale-[1.03] active:scale-100"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff' }}
            >
              {ctaLabel}
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              role="switch"
              aria-checked={isDarkTheme}
              aria-label={toggleLabel}
              onClick={toggleTheme}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${toggleButtonClass}`}
            >
              {isDarkTheme ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <Link
              to={ctaTo}
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-bold"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff' }}
            >
              {ctaLabel}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileOpen}
              className={`rounded-lg p-2 transition-colors ${mobileButtonClass}`}
            >
              {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav
            className={`flex flex-col gap-1 border-t pb-4 pt-3 md:hidden ${mobileNavClass}`}
            aria-label="Principal móvil"
          >
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  ['rounded-lg px-3 py-2 text-sm font-medium', isActive ? mobileActiveClass : mobileLinkClass].join(' ')
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
