import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  BookOpen,
  FolderOpen,
  Undo,
  Maximize2,
  Download,
  Upload,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  subscribeToExercises,
  saveExercise,
  deleteExercise,
  propagateExerciseUpdate,
} from '../services/trainingsService';
import CourtCanvas, { COURT_TOOLS } from '../components/CourtCanvas';

const EMPTY_EXERCISE = { nombre: '', descripcion: '', contenido: '', tipoPista: 'media', elementos: [] };

export default function ExerciseLibraryScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const importRef = useRef(null);

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingExercise, setEditingExercise] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [activeTool, setActiveTool] = useState('O');

  // Export state
  const [showExport, setShowExport] = useState(false);
  const [exportSelected, setExportSelected] = useState(new Set());

  // Import state
  const [importPreview, setImportPreview] = useState(null); // array of exercises to import
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToExercises(user.uid, db, appId, (data) => {
      setExercises(data);
      setLoading(false);
    });
  }, [user, db, appId]);

  // ─── Edit / Save ────────────────────────────────────────────────────────────

  async function handleSave(e) {
    e.preventDefault();
    if (!editingExercise.nombre.trim()) return;
    setSaving(true);
    try {
      const toSave = {
        ...editingExercise,
        id: editingExercise.id || crypto.randomUUID(),
        nombre: editingExercise.nombre.trim(),
      };
      await saveExercise(toSave, { uid: user.uid, db, appId });
      if (editingExercise.id) {
        await propagateExerciseUpdate(toSave, { uid: user.uid, db, appId });
      }
      setEditingExercise(null);
      setShowPlaybook(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await deleteExercise(id, { uid: user.uid, db, appId });
    setDeletingId(null);
  }

  function updateElementos(nuevos) {
    setEditingExercise((ex) => ({
      ...ex,
      elementos: typeof nuevos === 'function' ? nuevos(ex.elementos || []) : nuevos,
    }));
  }

  // ─── Export ─────────────────────────────────────────────────────────────────

  function openExport() {
    setExportSelected(new Set(exercises.map((ex) => ex.id)));
    setShowExport(true);
  }

  function toggleExportAll() {
    if (exportSelected.size === exercises.length) {
      setExportSelected(new Set());
    } else {
      setExportSelected(new Set(exercises.map((ex) => ex.id)));
    }
  }

  function toggleExportOne(id) {
    setExportSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function doExport() {
    const selected = exercises
      .filter((ex) => exportSelected.has(ex.id))
      .map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => rest);
    const blob = new Blob(
      [JSON.stringify({ version: 1, exportDate: new Date().toISOString(), exercises: selected }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ejercicios-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  }

  // ─── Import ─────────────────────────────────────────────────────────────────

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const list = Array.isArray(data.exercises) ? data.exercises : Array.isArray(data) ? data : null;
        if (!list) {
          alert('Archivo no válido.');
          return;
        }
        setImportPreview(list.map((ex) => ({ ...ex, _import: true })));
      } catch {
        alert('El archivo no es un JSON válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function doImport() {
    if (!importPreview?.length) return;
    setImporting(true);
    try {
      for (const ex of importPreview) {
        const { _import, id: _id, ...rest } = ex;
        await saveExercise({ ...rest, id: crypto.randomUUID() }, { uid: user.uid, db, appId });
      }
      setImportPreview(null);
    } finally {
      setImporting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const filtered = exercises.filter(
    (ex) =>
      ex.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      ex.descripcion?.toLowerCase().includes(search.toLowerCase()),
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
          <div className="flex items-center gap-2 flex-wrap">
            {/* Importar */}
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
            <button
              onClick={() => importRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
            >
              <Upload size={16} /> Importar
            </button>
            {/* Exportar */}
            {exercises.length > 0 && (
              <button
                onClick={openExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
              >
                <Download size={16} /> Exportar
              </button>
            )}
            {/* Nuevo */}
            <button
              onClick={() => {
                setEditingExercise({ ...EMPTY_EXERCISE });
                setShowPlaybook(false);
                setActiveTool('O');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition"
            >
              <Plus size={18} /> Nuevo ejercicio
            </button>
          </div>
        </div>

        {/* Buscador */}
        {exercises.length > 0 && (
          <input
            type="text"
            placeholder="Buscar ejercicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            <button
              onClick={() => {
                setEditingExercise({ ...EMPTY_EXERCISE });
                setShowPlaybook(false);
                setActiveTool('O');
              }}
              className="text-blue-600 font-bold hover:underline text-sm"
            >
              Crear ejercicio
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-12 text-sm">No hay ejercicios que coincidan.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((ex) => (
              <div key={ex.id} className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                {(ex.elementos?.length > 0 || ex.tipoPista) && (
                  <div className="px-4 pt-4 h-28 flex items-center justify-center bg-gray-50 border-b border-slate-100">
                    <CourtCanvas tipo={ex.tipoPista || 'media'} elementos={ex.elementos || []} readOnly={true} />
                  </div>
                )}
                <div className="p-4">
                  <p className="font-bold text-slate-800">{ex.nombre}</p>
                  {ex.contenido && (
                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mt-0.5">
                      {ex.contenido}
                    </p>
                  )}
                  {ex.descripcion && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{ex.descripcion}</p>}
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() => {
                        setEditingExercise({ ...ex, elementos: ex.elementos || [] });
                        setShowPlaybook(false);
                        setActiveTool('O');
                      }}
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

      {/* ─── Modal exportar ─── */}
      {showExport && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowExport(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Download size={18} className="text-blue-600" /> Exportar ejercicios
              </h3>
              <button onClick={() => setShowExport(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* Seleccionar todos */}
            <div className="px-6 py-3 border-b border-slate-100">
              <button
                onClick={toggleExportAll}
                className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition"
              >
                {exportSelected.size === exercises.length ? (
                  <CheckSquare size={16} className="text-blue-600" />
                ) : (
                  <Square size={16} />
                )}
                {exportSelected.size === exercises.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            {/* Lista de ejercicios */}
            <div className="overflow-y-auto flex-1 px-6 py-2">
              {exercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => toggleExportOne(ex.id)}
                  className="w-full flex items-center gap-3 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-lg px-1 transition text-left"
                >
                  {exportSelected.has(ex.id) ? (
                    <CheckSquare size={16} className="text-blue-600 shrink-0" />
                  ) : (
                    <Square size={16} className="text-slate-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{ex.nombre}</p>
                    {ex.contenido && <p className="text-xs text-indigo-500 font-semibold">{ex.contenido}</p>}
                  </div>
                </button>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowExport(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={doExport}
                disabled={exportSelected.size === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Download size={16} /> Exportar {exportSelected.size > 0 ? `(${exportSelected.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal importar preview ─── */}
      {importPreview && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setImportPreview(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Upload size={18} className="text-blue-600" /> Importar ejercicios
              </h3>
              <button onClick={() => setImportPreview(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="px-6 py-3 text-sm text-slate-500 border-b border-slate-100">
              Se añadirán{' '}
              <span className="font-bold text-slate-700">
                {importPreview.length} ejercicio{importPreview.length !== 1 ? 's' : ''}
              </span>{' '}
              a tu biblioteca. Los ejercicios existentes no se modificarán.
            </p>

            <div className="overflow-y-auto flex-1 px-6 py-2">
              {importPreview.map((ex, i) => (
                <div key={i} className="py-3 border-b border-slate-100 last:border-0">
                  <p className="font-semibold text-slate-800 text-sm">{ex.nombre || '(sin nombre)'}</p>
                  {ex.contenido && <p className="text-xs text-indigo-500 font-semibold mt-0.5">{ex.contenido}</p>}
                  {ex.descripcion && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ex.descripcion}</p>}
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setImportPreview(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={doImport}
                disabled={importing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Upload size={16} /> {importing ? 'Importando...' : `Importar (${importPreview.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal crear/editar ─── */}
      {editingExercise && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setEditingExercise(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={18} className="text-blue-600" />
                {editingExercise.id ? 'Editar ejercicio' : 'Nuevo ejercicio'}
              </h3>
              <button onClick={() => setEditingExercise(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre *</label>
                <input
                  type="text"
                  required
                  value={editingExercise.nombre}
                  onChange={(e) => setEditingExercise((ex) => ({ ...ex, nombre: e.target.value }))}
                  placeholder="Nombre del ejercicio"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Categoría / Contenido</label>
                <input
                  type="text"
                  value={editingExercise.contenido || ''}
                  onChange={(e) => setEditingExercise((ex) => ({ ...ex, contenido: e.target.value }))}
                  placeholder="Pase, Defensa, Tiro..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descripción</label>
                <textarea
                  value={editingExercise.descripcion || ''}
                  onChange={(e) => setEditingExercise((ex) => ({ ...ex, descripcion: e.target.value }))}
                  placeholder="Descripción del ejercicio..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Tipo de pista</label>
                <div className="flex gap-2">
                  {[
                    ['media', 'Media pista'],
                    ['entera', 'Pista entera'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditingExercise((ex) => ({ ...ex, tipoPista: val }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${editingExercise.tipoPista === val ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-600">Pizarra</label>
                  <button
                    type="button"
                    onClick={() => setShowPlaybook(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    <Maximize2 size={13} /> Abrir editor
                  </button>
                </div>
                <div
                  className="h-32 rounded-xl border border-slate-200 bg-gray-50 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition overflow-hidden"
                  onClick={() => setShowPlaybook(true)}
                >
                  <CourtCanvas
                    tipo={editingExercise.tipoPista}
                    elementos={editingExercise.elementos || []}
                    readOnly={true}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingExercise(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Playbook Editor ─── */}
      {editingExercise && showPlaybook && (
        <div className="fixed inset-0 z-[60] bg-gray-900/90 flex flex-col items-center justify-center p-4 touch-none">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
            <div className="flex flex-wrap justify-between items-center gap-2 p-3 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <h3 className="font-bold text-gray-800">Playbook Editor</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateElementos((els) => els.slice(0, -1))}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 rounded flex items-center text-sm"
                  >
                    <Undo size={14} className="mr-1" /> <span className="hidden sm:inline">Deshacer</span>
                  </button>
                  <button
                    onClick={() => updateElementos([])}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded flex items-center text-sm"
                  >
                    <Trash2 size={14} className="mr-1" /> <span className="hidden sm:inline">Limpiar</span>
                  </button>
                  <div className="flex gap-1 border-l border-gray-300 pl-2 ml-1">
                    {[
                      ['media', 'Media'],
                      ['entera', 'Entera'],
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setEditingExercise((ex) => ({ ...ex, tipoPista: val }))}
                        className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-semibold transition-colors ${editingExercise.tipoPista === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPlaybook(false)}
                className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col sm:flex-row flex-1 overflow-hidden bg-gray-100">
              {/* Toolbar móvil */}
              <div className="flex sm:hidden flex-wrap gap-1 p-2 bg-white border-b border-gray-200 overflow-x-auto">
                {COURT_TOOLS.filter((t) => !t.divider).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTool(t.id)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${activeTool === t.id ? 'bg-blue-100 text-blue-800 border border-blue-200 font-semibold' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
                  >
                    <div className="w-5 flex justify-center shrink-0">{t.icon}</div>
                    <span className="leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
              {/* Sidebar desktop */}
              <div className="hidden sm:flex w-48 bg-white border-r border-gray-200 flex-col p-2 gap-1 overflow-y-auto">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mt-2 mb-1">Herramientas</p>
                {COURT_TOOLS.map((t, idx) =>
                  t.divider ? (
                    <div key={idx} className="h-px bg-gray-200 my-1 mx-2" />
                  ) : (
                    <button
                      key={t.id}
                      onClick={() => setActiveTool(t.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${activeTool === t.id ? 'bg-blue-100 text-blue-800 border border-blue-200 font-semibold' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
                    >
                      <div className="w-6 flex justify-center shrink-0">{t.icon}</div>
                      <span className="text-xs leading-tight">{t.label}</span>
                    </button>
                  ),
                )}
                <div className="mt-auto p-3 bg-blue-50 rounded text-xs text-blue-800 leading-relaxed border border-blue-100 mx-1">
                  <b>Tip:</b> Objetos: clic para colocar. Líneas: clic y arrastra.
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center p-2 sm:p-6 select-none">
                <div className="bg-white shadow border border-gray-300 w-full h-full flex items-center justify-center">
                  <CourtCanvas
                    tipo={editingExercise.tipoPista}
                    elementos={editingExercise.elementos || []}
                    setElementos={updateElementos}
                    readOnly={false}
                    activeTool={activeTool}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal confirmar borrado ─── */}
      {deletingId && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setDeletingId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-2 text-slate-800">¿Eliminar ejercicio?</h3>
            <p className="text-slate-600 mb-6 text-sm">Se eliminará de la biblioteca permanentemente.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
