import React, { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useClubAllowlist } from '../hooks/useClubAllowlist';
import { CrearClubModal } from './CrearClubModal';

export function WorkspaceSelector() {
  const { memberships, activeWsId, setActiveWorkspace } = useWorkspace();
  const { allowed } = useClubAllowlist();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const active = memberships.find((m) => m.wsId === activeWsId);
  if (!active) return null;

  const onPick = (wsId) => {
    setActiveWorkspace(wsId);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 text-sm font-medium text-slate-700"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{active.workspaceName}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-2"
        >
          {memberships.map((m) => (
            <button
              key={m.wsId}
              role="menuitem"
              type="button"
              onClick={() => onPick(m.wsId)}
              className={`w-full text-left px-3 py-2 hover:bg-slate-50 text-sm ${m.wsId === activeWsId ? 'font-semibold text-blue-700' : 'text-slate-700'}`}
            >
              <span className="block">{m.workspaceName}</span>
              <span className="block text-xs text-slate-400">{m.workspaceType === 'club' ? 'Club' : 'Personal'}</span>
            </button>
          ))}
          {allowed && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setShowModal(true);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-blue-700 flex items-center gap-2"
              >
                <Plus size={14} aria-hidden="true" /> Crear workspace de club
              </button>
            </>
          )}
        </div>
      )}
      {showModal && <CrearClubModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
