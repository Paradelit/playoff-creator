import React, { useState } from 'react';
import { Plus, Trophy, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useCompetitions } from '../../hooks/useCompetitions';
import { saveCompetition, deleteCompetition } from '../../services/competitionsService';
import CompetitionFormModal from './CompetitionFormModal';
import ConfirmDialog from '../ConfirmDialog';

export default function CompetitionsTab({ teamId }) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const { competitions, loading } = useCompetitions(teamId);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function handleSave(competition) {
    await saveCompetition({ ...competition, id: competition.id || crypto.randomUUID() }, teamId, {
      uid: user.uid,
      db,
      appId,
    });
    setEditing(null);
  }

  async function handleDelete() {
    if (!deletingId) return;
    await deleteCompetition(deletingId, teamId, { uid: user.uid, db, appId });
    setDeletingId(null);
  }

  if (loading) {
    return <div className="text-sm text-slate-500 p-4">Cargando competiciones…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Competiciones</h3>
        <button
          type="button"
          onClick={() =>
            setEditing({ nombre: '', fases: [{ id: crypto.randomUUID(), nombre: 'Fase 1', jornadas: 22 }] })
          }
          className="text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1 text-sm transition"
        >
          <Plus size={15} aria-hidden="true" /> Añadir competición
        </button>
      </div>

      {competitions.length === 0 ? (
        <div className="text-sm text-slate-500 italic px-4 py-8 text-center bg-slate-50 rounded-xl border border-slate-200">
          Sin competiciones. Añade la liga del equipo para usarla en partidos.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {competitions.map((c) => (
            <li key={c.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
              <Trophy size={18} className="text-amber-500 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{c.nombre}</p>
                <p className="text-xs text-slate-500 truncate">
                  {(c.fases || []).map((f) => `${f.nombre} (${f.jornadas}j)`).join(' · ') || 'Sin fases'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(c)}
                aria-label="Editar competición"
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded transition"
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(c.id)}
                aria-label="Eliminar competición"
                className="text-red-400 hover:text-red-600 p-1.5 rounded transition"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && <CompetitionFormModal competition={editing} onSave={handleSave} onClose={() => setEditing(null)} />}

      {deletingId && (
        <ConfirmDialog
          title="Eliminar competición"
          message="Los partidos vinculados perderán su jornada. ¿Seguro?"
          confirmLabel="Eliminar"
          confirmTone="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
