import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import { useMembers } from '../../hooks/useMembers';
import { createMembersService } from '../../services/membersService';

export function TransferOwnershipScreen() {
  const { app } = useFirebase();
  const { user } = useAuth();
  const { activeWsId, activeWorkspace } = useWorkspace();
  const { push } = useToast();
  const { members } = useMembers(activeWsId);
  const navigate = useNavigate();
  const [pickedUid, setPickedUid] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const svc = useMemo(() => createMembersService({ app }), [app]);
  const isOwner = activeWorkspace?.ownerId === user?.uid;

  if (!activeWorkspace || activeWorkspace.type !== 'club' || !isOwner) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <p className="text-sm text-slate-600">Solo el propietario del club puede transferir la propiedad.</p>
      </div>
    );
  }

  const candidates = members.filter((m) => m.uid !== user.uid);
  const matches = confirmText === activeWorkspace.name;
  const disabled = submitting || !pickedUid || !matches;

  async function submit() {
    if (disabled) return;
    setSubmitting(true);
    try {
      await svc.transferOwnership({ wsId: activeWsId, newOwnerUid: pickedUid });
      push({ message: 'Propiedad transferida.', tone: 'success' });
      navigate('/area-privada/settings/miembros');
    } catch (err) {
      push({ message: err?.message || 'Error', tone: 'error' });
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Transferir propiedad</h1>
      <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 rounded mb-4">
        <p className="font-medium mb-1">Lee antes de continuar:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>El nuevo propietario tendrá control total: billing, ajustes y eliminar el workspace.</li>
          <li>Tu rol bajará a DT (puedes ser revocado o cambiar de rol después).</li>
          <li>Acción irreversible. Para volver, el nuevo propietario tendría que devolverte la propiedad.</li>
        </ul>
      </div>

      <fieldset className="mb-4">
        <legend className="text-sm font-medium mb-2">Nuevo propietario</legend>
        {candidates.length === 0 ? (
          <p className="text-sm text-slate-500">No hay otros miembros en el club. Invita a alguien antes.</p>
        ) : (
          candidates.map((m) => (
            <label key={m.uid} className="flex items-center gap-2 py-1">
              <input type="radio" name="newOwner" checked={pickedUid === m.uid} onChange={() => setPickedUid(m.uid)} />
              <span>{m.displayName || m.email}</span>
            </label>
          ))
        )}
      </fieldset>

      <label className="block text-sm font-medium mb-1">
        Para confirmar, escribe el nombre del workspace: <code className="text-blue-700">{activeWorkspace.name}</code>
      </label>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={activeWorkspace.name}
        className="w-full mb-4 px-3 py-2 border border-slate-300 rounded"
      />

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded disabled:opacity-40"
        >
          {submitting ? 'Transfiriendo...' : 'Transferir propiedad'}
        </button>
      </div>
    </div>
  );
}

export default TransferOwnershipScreen;
