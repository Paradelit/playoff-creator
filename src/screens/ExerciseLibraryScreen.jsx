import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, X, BookOpen, FolderOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToExercises, saveExercise, deleteExercise } from '../services/trainingsService';
import DrawableCourt from '../components/DrawableCourt';

const EMPTY_EXERCISE = { nombre: '', descripcion: '', contenido: '', tipoPista: 'media', trazos: [] };

export default function ExerciseLibraryScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingExercise, setEditingExercise] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToExercises(user.uid, db, appId, data => {
      setExercises(data);
      setLoading(false);
    });
  }, [user, db, appId]);

  async function handleSave(e) {
    e.preventDefault();
    if (!editingExercise.nombre.trim()) return;
    setSaving(true);
    try {
      await saveExercise({
        ...editingExercise,
        id: editingExercise.id || crypto.randomUUID(),
        nombre: editingExercise.nombre.trim(),
      }, { uid: user.uid, db, appId });
      setEditingExercise(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await deleteExercise(id, { uid: user.uid, db, appId });
    setDeletingId(null);
  }

  const filtered = exercises.filter(ex =>
    ex.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    ex.descripcion?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 p-6 sm:p-12 font-sans pb-24">
      <div className="max-w-4xl mx-auto">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition mb-6"
        >
          <ArrowLeft size={16} /> Volver
        </button>

        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <BookOpen className="text-amber-500" size={36} /> Biblioteca de Ejercicios
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Ejercicios reutilizables para tus entrenamientos.</p>
          </div>
          <button
            onClick={() => setEditingExercise({ ...EMPTY_EXERCISE })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
          >
            <Plus size={18} /> Nuevo ejercicio
          </button>
        </div>

        {/* Buscador */}
        {exercises.length > 0 && (
          <input
            type="text"
            placeholder="Buscar ejercicio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-6 bg-white"
          />
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : exercises.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center shadow-sm">
            <FolderOpen size={56} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">Sin ejercicios</h3>
            <p className="text-slate-500 mb-6 text-sm">Crea ejercicios reutilizables para tus entrenamientos.</p>
            <button onClick={() => setEditingExercise({ ...EMPTY_EXERCISE })} className="text-blue-600 font-bold hover:underline text-sm">
              Crear ejercicio
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-12 text-sm">No hay ejercicios que coincidan con tu búsqueda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map(ex => (
              <div key={ex.id} className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                {/* Miniatura de la pizarra */}
                {(ex.trazos?.length > 0 || ex.tipoPista) && (
                  <div className="px-4 pt-4">
                    <DrawableCourt tipo={ex.tipoPista || 'media'} trazos={ex.trazos || []} />
                  </div>
                )}
                <div className="p-4">
                  <p className="font-bold text-slate-800">{ex.nombre}</p>
                  {ex.contenido && <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mt-0.5">{ex.contenido}</p>}
                  {ex.descripcion && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{ex.descripcion}</p>}
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() => setEditingExercise({ ...ex })}
                      className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeletingId(ex.id)}
                      className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {editingExercise && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEditingExercise(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={18} className="text-blue-600" />
                {editingExercise.id ? 'Editar ejercicio' : 'Nuevo ejercicio'}
              </h3>
              <button onClick={() => setEditingExercise(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre *</label>
                <input
                  type="text"
                  required
                  value={editingExercise.nombre}
                  onChange={e => setEditingExercise(ex => ({ ...ex, nombre: e.target.value }))}
                  placeholder="Nombre del ejercicio"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Categoría / Contenido</label>
                <input
                  type="text"
                  value={editingExercise.contenido || ''}
                  onChange={e => setEditingExercise(ex => ({ ...ex, contenido: e.target.value }))}
                  placeholder="Pase, Defensa, Tiro..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descripción</label>
                <textarea
                  value={editingExercise.descripcion || ''}
                  onChange={e => setEditingExercise(ex => ({ ...ex, descripcion: e.target.value }))}
                  placeholder="Descripción del ejercicio..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Tipo de pista</label>
                <div className="flex gap-2">
                  {[['media', 'Media pista'], ['entera', 'Pista entera']].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditingExercise(ex => ({ ...ex, tipoPista: val }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${editingExercise.tipoPista === val ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Pizarra</label>
                <DrawableCourt
                  tipo={editingExercise.tipoPista}
                  trazos={editingExercise.trazos || []}
                  setTrazos={t => setEditingExercise(ex => ({ ...ex, trazos: typeof t === 'function' ? t(ex.trazos || []) : t }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingExercise(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar borrado */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setDeletingId(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2 text-slate-800">¿Eliminar ejercicio?</h3>
            <p className="text-slate-600 mb-6 text-sm">Se eliminará de la biblioteca permanentemente.</p>
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
