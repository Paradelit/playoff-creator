import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Download, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useToast } from '../contexts/ToastContext';
import { getSharedExercise } from '../services/exerciseSharingService';
import { saveExercise } from '../services/trainingsService';
import CourtCanvas from '../components/CourtCanvas';

export default function SharedExerciseScreen() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const toast = useToast();

  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!db || !appId || !shareCode) return;
    getSharedExercise(shareCode, { db, appId })
      .then((data) => {
        setExercise(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [db, appId, shareCode]);

  async function handleAddToLibrary() {
    if (!user) {
      toast('Inicia sesión para añadir a tu biblioteca', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveExercise(
        {
          id: crypto.randomUUID(),
          nombre: exercise.nombre,
          tags: exercise.tags || [],
          contenido: exercise.contenido || '',
          descripcion: exercise.descripcion || '',
          tipoPista: exercise.tipoPista || 'media',
          elementos: exercise.elementos || [],
        },
        { uid: user.uid, db, appId },
      );
      toast('Ejercicio añadido a tu biblioteca', 'success');
    } catch {
      toast('Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <BookOpen size={48} className="text-slate-300 mb-4" aria-hidden="true" />
        <h2 className="text-xl font-bold text-slate-700 mb-2">Ejercicio no encontrado</h2>
        <p className="text-slate-500 text-sm mb-6">El enlace puede haber expirado o ser incorrecto.</p>
        <button onClick={() => navigate('/area-privada')} className="text-blue-600 font-bold hover:underline text-sm">
          Ir al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 sm:p-12 font-sans">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/area-privada')}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition mb-6"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Inicio
        </button>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Ejercicio compartido</p>
            <h1 className="text-2xl font-bold text-slate-800">{exercise.nombre}</h1>
            {(exercise.tags?.length > 0 || exercise.contenido) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(exercise.tags || []).map((tag, i) => (
                  <span
                    key={i}
                    className="inline-block bg-indigo-100 text-indigo-600 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {!exercise.tags?.length && exercise.contenido && (
                  <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">
                    {exercise.contenido}
                  </span>
                )}
              </div>
            )}
            {exercise.sharedBy?.displayName && (
              <p className="text-xs text-slate-400 mt-2">Compartido por {exercise.sharedBy.displayName}</p>
            )}
          </div>

          <div className="p-6">
            <div
              className="bg-gray-50 rounded-xl border border-slate-200 flex items-center justify-center p-4 mb-5"
              style={{ minHeight: '280px', maxHeight: '55vh' }}
            >
              <CourtCanvas tipo={exercise.tipoPista || 'media'} elementos={exercise.elementos || []} readOnly={true} />
            </div>

            {exercise.descripcion && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Descripcion</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{exercise.descripcion}</p>
              </div>
            )}

            <p className="text-xs text-slate-400">{exercise.tipoPista === 'entera' ? 'Pista entera' : 'Media pista'}</p>
          </div>

          <div className="px-6 py-4 border-t border-slate-100">
            <button
              onClick={handleAddToLibrary}
              disabled={saving || !user}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Download size={16} aria-hidden="true" /> {saving ? 'Guardando...' : 'Añadir a mi biblioteca'}
            </button>
            {!user && (
              <p className="text-xs text-slate-400 text-center mt-2">Inicia sesión para guardar este ejercicio</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
