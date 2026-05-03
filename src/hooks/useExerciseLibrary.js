import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import {
  subscribeToExercises,
  saveExercise,
  deleteExercise,
  propagateExerciseUpdate,
  setFavorite,
} from '../services/trainingsService';
import { shareExercise } from '../services/exerciseSharingService';
import { useFirestoreSubscription } from './useFirestoreSubscription';

export function useExerciseLibrary() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const { activeWsId } = useWorkspace();
  const toast = useToast();
  const importRef = useRef(null);

  const subscribeFn = useCallback((cb) => subscribeToExercises(activeWsId, db, appId, cb), [activeWsId, db, appId]);
  const { data: rawExercises, loading } = useFirestoreSubscription(user && db && activeWsId ? subscribeFn : null);

  // Optimistic overrides for the favorite flag. Merged over subscription data
  // so a click feels instant; discarded when the server echo arrives.
  const [favoriteOverrides, setFavoriteOverrides] = useState({});
  const exercises = useMemo(
    () =>
      rawExercises.map((ex) =>
        Object.prototype.hasOwnProperty.call(favoriteOverrides, ex.id)
          ? { ...ex, favorite: favoriteOverrides[ex.id] }
          : ex,
      ),
    [rawExercises, favoriteOverrides],
  );

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Export state
  const [showExport, setShowExport] = useState(false);
  const [exportSelected, setExportSelected] = useState(new Set());

  // Import state
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  // Share state
  const [shareModal, setShareModal] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleSave(exercise) {
    setSaving(true);
    try {
      const pasos = exercise.pasos?.length > 0 ? exercise.pasos : [];
      const toSave = {
        ...exercise,
        id: exercise.id || crypto.randomUUID(),
        nombre: exercise.nombre.trim(),
        pasos,
        elementos: pasos[0]?.elementos || exercise.elementos || [],
      };
      await saveExercise(toSave, { wsId: activeWsId, db, appId });
      if (exercise.id) {
        await propagateExerciseUpdate(toSave, { wsId: activeWsId, db, appId });
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite(id) {
    const ex = exercises.find((e) => e.id === id);
    if (!ex) return;
    const next = !ex.favorite;
    setFavoriteOverrides((prev) => ({ ...prev, [id]: next }));
    try {
      await setFavorite(id, next, { wsId: activeWsId, db, appId });
    } catch (err) {
      setFavoriteOverrides((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      toast('No se pudo actualizar favorito', 'error');
      throw err;
    }
  }

  // Clear overrides once subscription echoes the server value.
  useEffect(() => {
    if (Object.keys(favoriteOverrides).length === 0) return;
    const stillStale = {};
    for (const [id, value] of Object.entries(favoriteOverrides)) {
      const ex = rawExercises.find((e) => e.id === id);
      if (ex && !!ex.favorite !== !!value) stillStale[id] = value;
    }
    if (Object.keys(stillStale).length !== Object.keys(favoriteOverrides).length) {
      setFavoriteOverrides(stillStale);
    }
  }, [rawExercises, favoriteOverrides]);

  async function handleDelete(id) {
    const ex = exercises.find((e) => e.id === id);
    const variants = exercises.filter((e) => e.parentId === id);
    if (variants.length > 0 && ex && !ex.parentId) {
      const [newParent, ...rest] = variants;
      await saveExercise({ ...newParent, parentId: null }, { wsId: activeWsId, db, appId });
      for (const v of rest) {
        await saveExercise({ ...v, parentId: newParent.id }, { wsId: activeWsId, db, appId });
      }
    }
    await deleteExercise(id, { wsId: activeWsId, db, appId });
    setDeletingId(null);
  }

  // Export
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

  // Import
  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const list = Array.isArray(data.exercises) ? data.exercises : Array.isArray(data) ? data : null;
        if (!list) {
          toast('Archivo no válido.', 'error');
          return;
        }
        setImportPreview(list.map((ex) => ({ ...ex, _import: true })));
      } catch {
        toast('El archivo no es un JSON válido.', 'error');
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
        await saveExercise({ ...rest, id: crypto.randomUUID() }, { wsId: activeWsId, db, appId });
      }
      setImportPreview(null);
    } finally {
      setImporting(false);
    }
  }

  // Share
  async function handleShare(exercise) {
    setSharing(true);
    try {
      const code = await shareExercise(exercise, {
        db,
        appId,
        uid: user.uid,
        displayName: user.displayName || user.email || 'Anónimo',
      });
      const url = `${window.location.origin}/exercise/${code}`;
      setShareModal({ shareCode: code, url });
      setLinkCopied(false);
    } catch {
      toast('Error al compartir', 'error');
    } finally {
      setSharing(false);
    }
  }

  async function copyShareLink() {
    if (!shareModal?.url) return;
    try {
      await navigator.clipboard.writeText(shareModal.url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast('No se pudo copiar', 'error');
    }
  }

  return {
    exercises,
    loading,
    saving,
    deletingId,
    setDeletingId,
    importRef,
    handleSave,
    handleDelete,
    toggleFavorite,
    // Export
    showExport,
    setShowExport,
    exportSelected,
    openExport,
    toggleExportAll,
    toggleExportOne,
    doExport,
    // Import
    importPreview,
    setImportPreview,
    importing,
    handleImportFile,
    doImport,
    // Share
    shareModal,
    setShareModal,
    sharing,
    linkCopied,
    handleShare,
    copyShareLink,
  };
}
