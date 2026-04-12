import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, BookOpen, FolderOpen, Download, Upload } from 'lucide-react';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';
import ExerciseCard, { prepareForEdit } from '../components/exercises/ExerciseCard';
import ExerciseFormModal from '../components/exercises/ExerciseFormModal';
import ExercisePreviewModal from '../components/exercises/ExercisePreviewModal';
import { ExportModal, ImportModal, ShareModal } from '../components/exercises/ExerciseListModals';

const EMPTY_EXERCISE = {
  nombre: '',
  descripcion: '',
  contenido: '',
  tags: [],
  tipoPista: 'media',
  elementos: [],
  pasos: [],
};

export default function ExerciseLibraryScreen() {
  const navigate = useNavigate();
  const lib = useExerciseLibrary();

  const [editingExercise, setEditingExercise] = useState(null);
  const [exerciseErrors, setExerciseErrors] = useState({});
  const [previewExercise, setPreviewExercise] = useState(null);
  const [search, setSearch] = useState('');
  const [filterTags, setFilterTags] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  function openNewExercise() {
    setEditingExercise(prepareForEdit({ ...EMPTY_EXERCISE }));
  }

  function openEditExercise(ex) {
    setEditingExercise(prepareForEdit(ex));
    setPreviewExercise(null);
  }

  function handleCreateVariant(parentExercise) {
    const rootId = parentExercise.parentId || parentExercise.id;
    setEditingExercise({
      ...parentExercise,
      id: undefined,
      parentId: rootId,
      variantName: '',
      nombre: `${parentExercise.nombre} (variante)`,
      createdAt: null,
      updatedAt: null,
    });
    setExpandedGroups((prev) => new Set([...prev, rootId]));
  }

  function toggleGroup(rootId) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(rootId) ? next.delete(rootId) : next.add(rootId);
      return next;
    });
  }

  async function handleFormSubmit(exercise) {
    await lib.handleSave(exercise);
    setEditingExercise(null);
    setExerciseErrors({});
  }

  const allTags = [...new Set(lib.exercises.flatMap((ex) => ex.tags || []))].sort();

  const filtered = lib.exercises.filter((ex) => {
    const matchesSearch =
      !search ||
      ex.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      ex.descripcion?.toLowerCase().includes(search.toLowerCase());
    const matchesTags =
      filterTags.length === 0 ||
      filterTags.every((tag) => (ex.tags || []).map((t) => t.toLowerCase()).includes(tag.toLowerCase()));
    return matchesSearch && matchesTags;
  });

  // Group exercises: parents with their variants
  const roots = [];
  const variantMap = new Map();
  filtered.forEach((ex) => {
    if (ex.parentId) {
      if (!variantMap.has(ex.parentId)) variantMap.set(ex.parentId, []);
      variantMap.get(ex.parentId).push(ex);
    } else {
      roots.push(ex);
    }
  });
  variantMap.forEach((variants, parentId) => {
    if (!roots.some((r) => r.id === parentId)) {
      variants.forEach((v) => roots.push(v));
      variantMap.delete(parentId);
    }
  });

  return (
    <div className="min-h-screen bg-slate-100 p-6 sm:p-12 font-sans pb-24">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition mb-6"
        >
          <ArrowLeft size={16} /> Volver
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <BookOpen className="text-amber-500" size={36} /> Biblioteca de Ejercicios
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Ejercicios reutilizables para tus entrenamientos.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={lib.importRef} type="file" accept=".json" className="hidden" onChange={lib.handleImportFile} />
            <button
              onClick={() => lib.importRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
            >
              <Upload size={16} /> Importar
            </button>
            {lib.exercises.length > 0 && (
              <button
                onClick={lib.openExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
              >
                <Download size={16} /> Exportar
              </button>
            )}
            <button
              onClick={openNewExercise}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition"
            >
              <Plus size={18} /> Nuevo ejercicio
            </button>
          </div>
        </div>

        {/* Search + tag filter */}
        {lib.exercises.length > 0 && (
          <div className="mb-6 space-y-3">
            <input
              type="text"
              placeholder="Buscar ejercicio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const active = filterTags.map((t) => t.toLowerCase()).includes(tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      onClick={() =>
                        setFilterTags((prev) =>
                          active ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...prev, tag],
                        )
                      }
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {tag}
                    </button>
                  );
                })}
                {filterTags.length > 0 && (
                  <button
                    onClick={() => setFilterTags([])}
                    className="px-3 py-1 rounded-full text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Exercise list */}
        {lib.loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lib.exercises.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center shadow-sm">
            <FolderOpen size={56} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">Sin ejercicios</h3>
            <p className="text-slate-500 mb-6 text-sm">Crea ejercicios reutilizables para tus entrenamientos.</p>
            <button onClick={openNewExercise} className="text-blue-600 font-bold hover:underline text-sm">
              Crear ejercicio
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-12 text-sm">No hay ejercicios que coincidan.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {roots.map((ex) => {
              const variants = variantMap.get(ex.id) || [];
              const hasVariants = variants.length > 0;
              const expanded = expandedGroups.has(ex.id);
              return (
                <div key={ex.id} className={hasVariants ? 'md:col-span-2' : ''}>
                  <ExerciseCard
                    ex={ex}
                    onPreview={setPreviewExercise}
                    onEdit={openEditExercise}
                    onDelete={lib.setDeletingId}
                    onCreateVariant={handleCreateVariant}
                    variantCount={variants.length}
                    expanded={expanded}
                    onToggleExpand={hasVariants ? () => toggleGroup(ex.id) : undefined}
                  />
                  {hasVariants && expanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 ml-4 pl-4 border-l-2 border-indigo-200">
                      {variants.map((v) => (
                        <ExerciseCard
                          key={v.id}
                          ex={v}
                          isVariant
                          onPreview={setPreviewExercise}
                          onEdit={openEditExercise}
                          onDelete={lib.setDeletingId}
                          onCreateVariant={handleCreateVariant}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewExercise && (
        <ExercisePreviewModal
          exercise={previewExercise}
          sharing={lib.sharing}
          onClose={() => setPreviewExercise(null)}
          onEdit={openEditExercise}
          onCreateVariant={handleCreateVariant}
          onShare={lib.handleShare}
        />
      )}

      {/* Form modal */}
      {editingExercise && (
        <ExerciseFormModal
          editingExercise={editingExercise}
          setEditingExercise={setEditingExercise}
          exerciseErrors={exerciseErrors}
          setExerciseErrors={setExerciseErrors}
          saving={lib.saving}
          allTags={allTags}
          onSubmit={handleFormSubmit}
          onClose={() => setEditingExercise(null)}
        />
      )}

      {/* Export modal */}
      {lib.showExport && (
        <ExportModal
          exercises={lib.exercises}
          exportSelected={lib.exportSelected}
          showExport={lib.showExport}
          setShowExport={lib.setShowExport}
          toggleExportAll={lib.toggleExportAll}
          toggleExportOne={lib.toggleExportOne}
          doExport={lib.doExport}
        />
      )}

      {/* Import modal */}
      {lib.importPreview && (
        <ImportModal
          importPreview={lib.importPreview}
          setImportPreview={lib.setImportPreview}
          importing={lib.importing}
          doImport={lib.doImport}
        />
      )}

      {/* Delete confirmation */}
      {lib.deletingId && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
          onClick={() => lib.setDeletingId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-2 text-slate-800">¿Eliminar ejercicio?</h3>
            <p className="text-slate-600 mb-6 text-sm">Se eliminará de la biblioteca permanentemente.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => lib.setDeletingId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => lib.handleDelete(lib.deletingId)}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {lib.shareModal && (
        <ShareModal
          shareModal={lib.shareModal}
          setShareModal={lib.setShareModal}
          linkCopied={lib.linkCopied}
          copyShareLink={lib.copyShareLink}
        />
      )}
    </div>
  );
}
