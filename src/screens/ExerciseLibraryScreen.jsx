import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen, Star, Clock, TrendingUp, BookOpen } from 'lucide-react';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';
import { useAllTrainings } from '../hooks/useAllTrainings';
import { useExerciseInsights } from '../hooks/useExerciseInsights';
import { useExerciseFilters } from '../hooks/useExerciseFilters';
import { useRegisterScreenContext } from '../hooks/useRegisterScreenContext';
import ExerciseCard, { prepareForEdit } from '../components/exercises/ExerciseCard';
import ExerciseFormModal from '../components/exercises/ExerciseFormModal';
import ExercisePreviewModal from '../components/exercises/ExercisePreviewModal';
import { ExportModal, ImportModal, ShareModal } from '../components/exercises/ExerciseListModals';
import LibraryHeader from '../components/exercises/library/LibraryHeader';
import StickyFilterBar from '../components/exercises/library/StickyFilterBar';
import FilterSidebar from '../components/exercises/library/FilterSidebar';
import FilterSheet from '../components/exercises/library/FilterSheet';
import ExerciseSection from '../components/exercises/library/ExerciseSection';
import { activeCategoryIds, EXERCISE_CATEGORIES } from '../utils/exerciseCategories';

const EMPTY_EXERCISE = {
  nombre: '',
  descripcion: '',
  contenido: '',
  tags: [],
  tipoPista: 'media',
  elementos: [],
  pasos: [],
};

function countByCategory(exercises) {
  const counts = Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c.id, 0]));
  for (const ex of exercises) {
    for (const id of activeCategoryIds(ex.tags || [])) counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

export default function ExerciseLibraryScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const lib = useExerciseLibrary();
  const { allTrainings } = useAllTrainings();
  const insights = useExerciseInsights(lib.exercises, allTrainings);
  const { filters, setFilter, toggleCategory, reset, hasActiveFilters, filtered, roots, variantMap } =
    useExerciseFilters(lib.exercises);

  useRegisterScreenContext({ exerciseCount: lib.exercises.length });

  const [editingExercise, setEditingExercise] = useState(null);
  const [exerciseErrors, setExerciseErrors] = useState({});
  const [previewExercise, setPreviewExercise] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  useEffect(() => {
    if (!location.hash || lib.loading) return;
    const id = location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, lib.loading]);

  const categoryCounts = useMemo(() => countByCategory(lib.exercises), [lib.exercises]);
  const activeFilterCount =
    (filters.categories?.length || 0) +
    (filters.phase ? 1 : 0) +
    (filters.difficulty != null ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0);

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

  const allTags = useMemo(() => [...new Set(lib.exercises.flatMap((ex) => ex.tags || []))].sort(), [lib.exercises]);

  const cardHandlers = {
    onPreview: setPreviewExercise,
    onEdit: openEditExercise,
    onDelete: lib.setDeletingId,
    onCreateVariant: handleCreateVariant,
    onToggleFavorite: lib.toggleFavorite,
  };

  function renderCarouselCard(ex) {
    const usage = insights.usageById[ex.id];
    return (
      <div key={ex.id} className="snap-start shrink-0 w-[78vw] xs:w-72 sm:w-72">
        <ExerciseCard
          ex={ex}
          {...cardHandlers}
          compact
          showUsageBadge
          usageCount={usage?.countAll}
          lastUsedAt={usage?.lastUsedMs}
        />
      </div>
    );
  }

  const isFirstRun = !lib.loading && lib.exercises.length === 0;
  const favoritesEmpty = insights.favorites.length === 0;
  const recentlyUsedEmpty = insights.recentlyUsed.length === 0;
  const trendingEmpty = insights.trending.length === 0;
  const todosEmpty = roots.length === 0;

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-24">
      <div className="p-6 sm:p-12 max-w-7xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition mb-5"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Volver
        </button>

        <LibraryHeader
          exerciseCount={lib.exercises.length}
          importRef={lib.importRef}
          onImport={lib.handleImportFile}
          onExport={lib.openExport}
          onCreate={openNewExercise}
          showExport={lib.exercises.length > 0}
        />

        {isFirstRun ? (
          <div className="mt-10 bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 sm:p-16 text-center shadow-sm">
            <FolderOpen size={56} className="mx-auto text-slate-300 mb-4" aria-hidden="true" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">Sin ejercicios</h3>
            <p className="text-slate-500 mb-6 text-sm">Crea ejercicios reutilizables para tus entrenamientos.</p>
            <button onClick={openNewExercise} className="text-blue-600 font-bold hover:underline text-sm">
              Crear ejercicio
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5">
              <StickyFilterBar
                search={filters.search}
                onSearchChange={(v) => setFilter('search', v)}
                categories={filters.categories}
                onToggleCategory={toggleCategory}
                onOpenSheet={() => setFilterSheetOpen(true)}
                activeFilterCount={activeFilterCount}
                categoryCounts={categoryCounts}
              />
            </div>

            <div className="flex gap-6 mt-6">
              <FilterSidebar
                filters={filters}
                onToggleCategory={toggleCategory}
                onSetFilter={setFilter}
                onReset={reset}
                hasActiveFilters={hasActiveFilters}
                categoryCounts={categoryCounts}
              />

              <div className="flex-1 min-w-0 space-y-8">
                {lib.loading ? (
                  <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : hasActiveFilters ? (
                  <ExerciseSection
                    id="resultados"
                    icon={BookOpen}
                    iconColor="text-slate-600"
                    title="Resultados"
                    count={filtered.length}
                    variant="grid"
                    gridCols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                    isEmpty={todosEmpty}
                    emptyHidden={false}
                  >
                    {todosEmpty ? (
                      <p className="text-center text-slate-500 py-10 text-sm col-span-full">
                        No hay ejercicios que coincidan.
                      </p>
                    ) : (
                      roots.map((ex) => {
                        const variants = variantMap.get(ex.id) || [];
                        const hasVariants = variants.length > 0;
                        const expanded = expandedGroups.has(ex.id);
                        const usage = insights.usageById[ex.id];
                        return (
                          <div key={ex.id} className={hasVariants ? 'xl:col-span-3 sm:col-span-2' : ''}>
                            <ExerciseCard
                              ex={ex}
                              {...cardHandlers}
                              variantCount={variants.length}
                              expanded={expanded}
                              onToggleExpand={hasVariants ? () => toggleGroup(ex.id) : undefined}
                              showUsageBadge={!!usage}
                              usageCount={usage?.countAll}
                              lastUsedAt={usage?.lastUsedMs}
                            />
                            {hasVariants && expanded && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 ml-4 pl-4 border-l-2 border-indigo-200">
                                {variants.map((v) => (
                                  <ExerciseCard key={v.id} ex={v} isVariant {...cardHandlers} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </ExerciseSection>
                ) : (
                  <>
                    <ExerciseSection
                      id="favoritos"
                      icon={Star}
                      iconColor="text-amber-500"
                      title="Favoritos"
                      subtitle="Los ejercicios que has marcado como favoritos"
                      count={insights.favorites.length}
                      variant="carousel"
                      isEmpty={favoritesEmpty}
                    >
                      {insights.favorites.map(renderCarouselCard)}
                    </ExerciseSection>

                    <ExerciseSection
                      id="recien"
                      icon={Clock}
                      iconColor="text-blue-500"
                      title="Recién usados"
                      subtitle="Lo último que has llevado al entrenamiento"
                      count={insights.recentlyUsed.length}
                      variant="carousel"
                      isEmpty={recentlyUsedEmpty}
                    >
                      {insights.recentlyUsed.map(renderCarouselCard)}
                    </ExerciseSection>

                    <ExerciseSection
                      id="tendencias"
                      icon={TrendingUp}
                      iconColor="text-emerald-500"
                      title="Tendencias"
                      subtitle="Los que más has repetido en los últimos 30 días"
                      count={insights.trending.length}
                      variant="carousel"
                      isEmpty={trendingEmpty}
                    >
                      {insights.trending.map(renderCarouselCard)}
                    </ExerciseSection>

                    <ExerciseSection
                      id="todos"
                      icon={BookOpen}
                      iconColor="text-slate-600"
                      title="Todos"
                      count={lib.exercises.length}
                      variant="grid"
                      gridCols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                      isEmpty={todosEmpty}
                      emptyHidden={false}
                    >
                      {roots.map((ex) => {
                        const variants = variantMap.get(ex.id) || [];
                        const hasVariants = variants.length > 0;
                        const expanded = expandedGroups.has(ex.id);
                        return (
                          <div key={ex.id} className={hasVariants ? 'xl:col-span-3 sm:col-span-2' : ''}>
                            <ExerciseCard
                              ex={ex}
                              {...cardHandlers}
                              variantCount={variants.length}
                              expanded={expanded}
                              onToggleExpand={hasVariants ? () => toggleGroup(ex.id) : undefined}
                            />
                            {hasVariants && expanded && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 ml-4 pl-4 border-l-2 border-indigo-200">
                                {variants.map((v) => (
                                  <ExerciseCard key={v.id} ex={v} isVariant {...cardHandlers} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </ExerciseSection>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onToggleCategory={toggleCategory}
        onSetFilter={setFilter}
        onReset={reset}
        hasActiveFilters={hasActiveFilters}
        categoryCounts={categoryCounts}
      />

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

      {lib.importPreview && (
        <ImportModal
          importPreview={lib.importPreview}
          setImportPreview={lib.setImportPreview}
          importing={lib.importing}
          doImport={lib.doImport}
        />
      )}

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
