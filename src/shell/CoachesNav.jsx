import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Trophy, Users } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',         label: 'Inicio',   Icon: Home,   end: true  },
  { to: '/playoffs', label: 'Playoffs', Icon: Trophy, end: false },
  { to: '/teams',    label: 'Equipos',  Icon: Users,  end: false },
];

export default function CoachesNav() {
  const location = useLocation();

  if (location.pathname === '/login') return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] bg-blue-950 border-t border-blue-900 flex items-stretch h-16"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {NAV_ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              isActive ? 'text-amber-400' : 'text-blue-400 hover:text-blue-200'
            }`
          }
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
