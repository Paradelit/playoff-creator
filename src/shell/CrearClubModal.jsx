import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import { createMembersService } from '../services/membersService';

export function CrearClubModal({ onClose }) {
  const { app } = useFirebase();
  const { setActiveWorkspace } = useWorkspace();
  const { push } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = name.trim();
  const disabled = submitting || trimmed.length === 0 || trimmed.length > 80;

  async function onSubmit(e) {
    e.preventDefault();
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const svc = createMembersService({ app });
      const { wsId } = await svc.createClub({ name: trimmed });
      setActiveWorkspace(wsId);
      push({ message: 'Workspace de club creado.', tone: 'success' });
      onClose();
      navigate('/area-privada');
    } catch (err) {
      const code = err?.code || '';
      if (code.endsWith('permission-denied')) setError('Workspace de club no disponible para esta cuenta.');
      else setError(err?.message || 'Error al crear el workspace.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crear-club-title"
    >
      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 id="crear-club-title" className="text-lg font-semibold text-slate-900">
            Crear workspace de club
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Un club agrupa varios entrenadores bajo una misma estructura. Tú serás el propietario y podrás invitar a tu
          staff después.
        </p>
        <label htmlFor="club-name" className="block text-sm font-medium text-slate-700 mb-1">
          Nombre
        </label>
        <input
          id="club-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Uros de Rivas"
          maxLength={80}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  );
}
