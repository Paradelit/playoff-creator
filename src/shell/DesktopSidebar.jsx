import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Settings, LogOut, ShieldHalf } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NAV_ITEMS, CreateSheet } from './CoachesNav';

function SidebarItem({ to, label, Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          isActive ? 'bg-blue-900 text-amber-400' : 'text-blue-200 hover:bg-blue-900 hover:text-white'
        }`
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function DesktopSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, handleLogout } = useAuth();
  const [showCreate, setShowCreate] = useState(false);

  if (location.pathname === '/login') return null;

  const displayName = user?.isAnonymous ? 'Invitado' : user?.displayName || user?.email?.split('@')[0] || 'Entrenador';
  const photoURL = user?.photoURL || null;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 z-[100] w-60 bg-blue-950 border-r border-blue-900 flex-col">
        <div className="px-5 pt-6 pb-4 flex items-center gap-2 border-b border-blue-900">
          <ShieldHalf size={22} className="text-amber-400" />
          <span className="text-white font-bold text-base tracking-tight">Playoff Creator</span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.to} {...item} />
          ))}

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-blue-950 font-bold text-sm transition-colors"
          >
            <Plus size={18} strokeWidth={3} />
            <span>Crear</span>
          </button>
        </nav>

        <div className="border-t border-blue-900 px-3 py-4 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-blue-200 hover:bg-blue-900 hover:text-white transition-colors"
          >
            {photoURL ? (
              <img src={photoURL} alt="Avatar" className="w-6 h-6 rounded-full border border-blue-700" />
            ) : (
              <div className="w-6 h-6 bg-blue-800 rounded-full flex items-center justify-center text-white font-bold text-xs">
                {initial}
              </div>
            )}
            <span className="truncate">{displayName}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium text-blue-300 hover:bg-blue-900 hover:text-white transition-colors"
          >
            <Settings size={14} /> Ajustes
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium text-blue-300 hover:bg-blue-900 hover:text-white transition-colors"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {showCreate && <CreateSheet onClose={() => setShowCreate(false)} />}
    </>
  );
}
