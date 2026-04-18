import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Settings, LogOut, ShieldHalf, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { NAV_ITEMS, CreateSheet } from './CoachesNav';

function SidebarItem({ to, label, Icon, end, collapsed }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-4'} py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          isActive ? 'bg-blue-900 text-amber-400' : 'text-blue-200 hover:bg-blue-900 hover:text-white'
        }`
      }
    >
      <Icon size={18} />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

function Avatar({ photoURL, initial, size }) {
  if (photoURL) {
    return <img src={photoURL} alt="Avatar" className={`${size} rounded-full border border-blue-700`} />;
  }
  return (
    <div className={`${size} bg-blue-800 rounded-full flex items-center justify-center text-white font-bold text-xs`}>
      {initial}
    </div>
  );
}

function CollapsedFooter({ navigate, handleLogout, photoURL, initial, displayName }) {
  return (
    <>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        title={displayName}
        className="flex items-center justify-center p-2 rounded-xl text-blue-200 hover:bg-blue-900 hover:text-white transition-colors"
      >
        <Avatar photoURL={photoURL} initial={initial} size="w-7 h-7" />
      </button>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        title="Ajustes"
        className="flex items-center justify-center p-2 rounded-xl text-blue-300 hover:bg-blue-900 hover:text-white transition-colors"
      >
        <Settings size={16} />
      </button>
      <button
        type="button"
        onClick={handleLogout}
        title="Cerrar sesión"
        className="flex items-center justify-center p-2 rounded-xl text-blue-300 hover:bg-blue-900 hover:text-white transition-colors"
      >
        <LogOut size={16} />
      </button>
    </>
  );
}

function ExpandedFooter({ navigate, handleLogout, photoURL, initial, displayName }) {
  return (
    <>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-blue-200 hover:bg-blue-900 hover:text-white transition-colors"
      >
        <Avatar photoURL={photoURL} initial={initial} size="w-6 h-6" />
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
    </>
  );
}

function SidebarHeader({ collapsed, toggle, ToggleIcon }) {
  if (collapsed) {
    return (
      <div className="pt-6 pb-4 flex items-center border-b border-blue-900 px-0 justify-center">
        <button
          type="button"
          onClick={toggle}
          title="Expandir (Ctrl/Cmd+B)"
          aria-label="Expandir panel lateral"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-amber-400 hover:bg-blue-900 transition-colors"
        >
          <ShieldHalf size={20} />
        </button>
      </div>
    );
  }
  return (
    <div className="pt-6 pb-4 flex items-center border-b border-blue-900 px-5 gap-2 justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldHalf size={22} className="text-amber-400 shrink-0" />
        <span className="text-white font-bold text-base tracking-tight truncate">Playoff Creator</span>
      </div>
      <button
        type="button"
        onClick={toggle}
        title="Colapsar (Ctrl/Cmd+B)"
        aria-label="Colapsar panel lateral"
        className="text-blue-300 hover:text-white p-1 rounded-lg hover:bg-blue-900 transition-colors"
      >
        <ToggleIcon size={16} />
      </button>
    </div>
  );
}

export default function DesktopSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, handleLogout } = useAuth();
  const { collapsed, toggle } = useSidebar();
  const [showCreate, setShowCreate] = useState(false);

  if (location.pathname === '/login') return null;

  const displayName = user?.isAnonymous ? 'Invitado' : user?.displayName || user?.email?.split('@')[0] || 'Entrenador';
  const photoURL = user?.photoURL || null;
  const initial = displayName.charAt(0).toUpperCase();

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const widthClass = collapsed ? 'w-16' : 'w-60';

  return (
    <>
      <aside
        className={`hidden md:flex fixed top-0 left-0 bottom-0 z-[100] ${widthClass} bg-blue-950 border-r border-blue-900 flex-col transition-[width] duration-200`}
      >
        <SidebarHeader collapsed={collapsed} toggle={toggle} ToggleIcon={ToggleIcon} />

        <nav className={`flex-1 py-4 flex flex-col gap-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.to} {...item} collapsed={collapsed} />
          ))}

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            title={collapsed ? 'Crear' : undefined}
            className={`mt-3 flex items-center ${collapsed ? 'justify-center px-2' : 'px-4 gap-3'} py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-blue-950 font-bold text-sm transition-colors`}
          >
            <Plus size={18} strokeWidth={3} />
            {!collapsed && <span>Crear</span>}
          </button>
        </nav>

        <div className={`border-t border-blue-900 py-4 flex flex-col gap-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {collapsed ? (
            <CollapsedFooter
              navigate={navigate}
              handleLogout={handleLogout}
              photoURL={photoURL}
              initial={initial}
              displayName={displayName}
            />
          ) : (
            <ExpandedFooter
              navigate={navigate}
              handleLogout={handleLogout}
              photoURL={photoURL}
              initial={initial}
              displayName={displayName}
            />
          )}
        </div>
      </aside>

      {showCreate && <CreateSheet onClose={() => setShowCreate(false)} />}
    </>
  );
}
