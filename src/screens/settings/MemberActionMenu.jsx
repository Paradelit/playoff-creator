import React, { useState } from 'react';
import { MoreVertical } from 'lucide-react';

export function MemberActionMenu({ member, teams, onChangeRole, onEditTeams, onRevoke }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [pickedTeams, setPickedTeams] = useState(member.assignedTeamIds);
  const [pickedRole, setPickedRole] = useState(member.role);

  return (
    <>
      <button
        type="button"
        aria-label="Acciones"
        onClick={() => setOpen((v) => !v)}
        className="p-1 hover:bg-slate-100 rounded"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute mt-1 w-48 bg-white border border-slate-200 rounded shadow-lg z-40">
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setModal('role');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
          >
            Cambiar rol
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setModal('teams');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
          >
            Editar equipos
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setModal('revoke');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-red-600"
          >
            Revocar acceso
          </button>
        </div>
      )}

      {modal === 'role' && (
        <ConfirmModal
          title="Cambiar rol"
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await onChangeRole(pickedRole);
            setModal(null);
          }}
        >
          <p className="text-sm text-slate-600 mb-2">
            Si bajas a Coach, perderá acceso club-wide a la biblioteca de ejercicios.
          </p>
          <label className="block py-1">
            <input
              type="radio"
              name="memberRole"
              aria-label="DT"
              checked={pickedRole === 'dt'}
              onChange={() => setPickedRole('dt')}
            />{' '}
            DT
          </label>
          <label className="block py-1">
            <input
              type="radio"
              name="memberRole"
              aria-label="Coach"
              checked={pickedRole === 'coach'}
              onChange={() => setPickedRole('coach')}
            />{' '}
            Coach
          </label>
        </ConfirmModal>
      )}
      {modal === 'teams' && (
        <ConfirmModal
          title="Editar equipos asignados"
          confirmLabel="Guardar"
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await onEditTeams(pickedTeams);
            setModal(null);
          }}
        >
          {teams.map((t) => (
            <label key={t.id} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                aria-label={t.name}
                checked={pickedTeams.includes(t.id)}
                onChange={() =>
                  setPickedTeams((cur) => (cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id]))
                }
              />{' '}
              {t.name}
            </label>
          ))}
        </ConfirmModal>
      )}
      {modal === 'revoke' && (
        <ConfirmModal
          title="Revocar acceso"
          tone="danger"
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await onRevoke();
            setModal(null);
          }}
        >
          <p className="text-sm text-slate-600">
            Sus contribuciones se mantienen pero firmadas con su nombre. Acción irreversible.
          </p>
        </ConfirmModal>
      )}
    </>
  );
}

function ConfirmModal({ title, children, onCancel, onConfirm, tone, confirmLabel = 'Confirmar' }) {
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        {children}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} className="px-3 py-1 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className={`px-3 py-1 text-sm rounded text-white ${tone === 'danger' ? 'bg-red-600' : 'bg-blue-600'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
