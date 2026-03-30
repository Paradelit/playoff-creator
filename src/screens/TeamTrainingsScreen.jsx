import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ArrowRight, ClipboardList, BookOpen, FolderOpen, ShieldHalf } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams } from '../services/teamsService';
import { subscribeToTrainings, saveTraining, deleteTraining } from '../services/trainingsService';
import { teamDisplayName } from './TeamsScreen';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function TeamTrainingsScreen() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [team, setTeam] = useState(null);
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeams(user.uid, db, appId, data => {
      setTeam(data.find(t => t.id === teamId) || null);
    });
  }, [user, db, appId, teamId]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTrainings(teamId, user.uid, db, appId, data => {
      setTrainings(data);
      setLoading(false);
    });
  }, [user, db, appId, teamId]);

  async function handleCreate() {
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      const numero = trainings.length + 1;
      await saveTraining({
        id,
        teamId,
        meta: { numero, dia: '', fecha: '', horaInicio: '', horaFin: '', lugar: '' },
        objetivos: '',
        ejercicios: [],
        cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
      }, teamId, { uid: user.uid, db, appId });
      navigate(`/teams/${teamId}/trainings/${id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    await deleteTraining(id, teamId, { uid: user.uid, db, appId });
    setDeletingId(null);
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 sm:p-12 font-sans pb-24">
      <div className="max-w-3xl mx-auto">

        {/* Navegación */}
        <button
          onClick={() => navigate(`/teams/${teamId}/cuaderno`)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition mb-6"
        >
          <ArrowLeft size={16} />
          Cuaderno
        </button>

        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ClipboardList className="text-amber-500" size={36} /> Entrenamientos
            </h1>
            {team && (
              <p className="text-slate-500 mt-1 flex items-center gap-1.5">
                <ShieldHalf size={14} className="text-blue-600" />
                {teamDisplayName(team)}
              </p>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => navigate('/exercises')}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition"
            >
              <BookOpen size={16} /> Biblioteca
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105 disabled:opacity-60"
            >
              <Plus size={18} /> Nuevo entrenamiento
            </button>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trainings.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center shadow-sm">
            <FolderOpen size={56} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">Sin entrenamientos</h3>
            <p className="text-slate-500 mb-6 text-sm">Crea el primer entrenamiento para este equipo.</p>
            <button onClick={handleCreate} className="text-blue-600 font-bold hover:underline text-sm">
              Crear entrenamiento
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trainings.map(t => (
              <div key={t.id} className="bg-white rounded-xl shadow-md border border-slate-200 px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-sm">#{t.meta?.numero ?? '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm">
                    Entrenamiento {t.meta?.numero ?? ''}
                    {t.meta?.fecha ? ` · ${formatDate(t.meta.fecha)}` : ''}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {[t.meta?.dia, t.meta?.horaInicio && t.meta?.horaFin ? `${t.meta.horaInicio}–${t.meta.horaFin}` : t.meta?.horaInicio, t.meta?.lugar].filter(Boolean).join(' · ') || 'Sin detalles'}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/teams/${teamId}/trainings/${t.id}`)}
                  className="text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1 text-sm shrink-0"
                >
                  Abrir <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => setDeletingId(t.id)}
                  className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal confirmar borrado */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setDeletingId(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2 text-slate-800">¿Eliminar entrenamiento?</h3>
            <p className="text-slate-600 mb-6 text-sm">Esta acción es permanente y no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition">Cancelar</button>
              <button onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
