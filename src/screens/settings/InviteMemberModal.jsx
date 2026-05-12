import React, { useState } from 'react';
import { X } from 'lucide-react';
import { teamDisplayName } from '../../utils/teamUtils';

export function InviteMemberModal({ teams, onClose, onSubmit, submitting }) {
  const [role, setRole] = useState('coach');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState(null);

  const togglePick = (id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const disabled = submitting || (role === 'coach' && picked.length === 0);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ role, email: email.trim() || null, name: name.trim() || null, assignedTeamIds: picked });
    } catch (err) {
      setError(err?.message || 'Error');
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-member-modal-title"
    >
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between mb-4">
          <h2 id="invite-member-modal-title" className="text-lg font-semibold">
            Invitar al staff
          </h2>
          <button type="button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <fieldset className="mb-3">
          <legend className="text-sm font-medium mb-1">Rol</legend>
          <label className="inline-flex items-center gap-2 mr-4">
            <input
              type="radio"
              name="role"
              aria-label="Coach"
              checked={role === 'coach'}
              onChange={() => setRole('coach')}
            />{' '}
            Coach
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="role" aria-label="DT" checked={role === 'dt'} onChange={() => setRole('dt')} /> DT
          </label>
        </fieldset>
        <label className="block text-sm mb-1">Email (opcional)</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 border rounded px-2 py-1"
        />
        <label className="block text-sm mb-1">Nombre (opcional)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-3 border rounded px-2 py-1"
        />
        <fieldset className="mb-3">
          <legend className="text-sm font-medium mb-1">
            Equipos asignados {role === 'coach' && <span className="text-red-500">*</span>}
          </legend>
          {teams.map((t) => {
            const label = teamDisplayName(t);
            return (
              <label key={t.id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={picked.includes(t.id)}
                  onChange={() => togglePick(t.id)}
                />{' '}
                {label}
              </label>
            );
          })}
        </fieldset>
        {error && (
          <p className="text-red-600 text-sm" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-40"
          >
            {submitting ? 'Generando...' : 'Generar invitación'}
          </button>
        </div>
      </form>
    </div>
  );
}
