import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToMembers } from '../services/teamsService';
import { subscribeToTrainings, saveTraining, subscribeToExercises, saveExercise } from '../services/trainingsService';
import { useTeams } from './useTeams';
import { useProfile } from './useProfile';

function makeEjercicio() {
  return { id: crypto.randomUUID(), tiempo: '', contenido: '', descripcion: '', tipoPista: 'media', elementos: [] };
}

function EMPTY_TRAINING(numero = 1) {
  return {
    meta: { numero, dia: '', fecha: '', horaInicio: '', horaFin: '', lugar: '' },
    objetivos: '',
    ejercicios: [
      { ...makeEjercicio(), tipoPista: 'entera' },
      { ...makeEjercicio(), tipoPista: 'entera' },
      { ...makeEjercicio(), tipoPista: 'entera' },
      makeEjercicio(),
      makeEjercicio(),
      makeEjercicio(),
      makeEjercicio(),
    ],
    cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
  };
}

export function useTrainingEditor() {
  const { teamId, trainingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const { teams } = useTeams();
  const { profile } = useProfile();
  const team = teams.find((t) => t.id === teamId) || null;
  const [members, setMembers] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [modalEjercicioId, setModalEjercicioId] = useState(null);
  const [libraryPrompt, setLibraryPrompt] = useState(null);
  const [activeTool, setActiveTool] = useState('O');
  const [libraryPanel, setLibraryPanel] = useState({ open: false, targetId: null });
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFilterTags, setLibraryFilterTags] = useState([]);

  const saveTimerRef = useRef(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToMembers(teamId, user.uid, db, appId, setMembers);
  }, [user, db, appId, teamId]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToExercises(user.uid, db, appId, setExercises);
  }, [user, db, appId]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTrainings(teamId, user.uid, db, appId, (data) => {
      const found = data.find((t) => t.id === trainingId);
      if (isFirstLoad.current) {
        setTraining(
          found
            ? { ...found, ejercicios: (found.ejercicios || []).map((e) => ({ ...e, elementos: e.elementos || [] })) }
            : { id: trainingId, teamId, ...EMPTY_TRAINING() },
        );
        isFirstLoad.current = false;
      }
      setLoading(false);
    });
  }, [user, db, appId, teamId, trainingId]);

  const triggerSave = useCallback(
    (t) => {
      setSaveStatus('saving');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await saveTraining(t, teamId, { uid: user.uid, db, appId });
          setSaveStatus('saved');
        } catch {
          setSaveStatus('saved');
        }
      }, 1500);
    },
    [teamId, user, db, appId],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function updateTraining(updater) {
    setTraining((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      triggerSave(next);
      return next;
    });
  }

  function updateMeta(field, value) {
    updateTraining((t) => ({ ...t, meta: { ...t.meta, [field]: value } }));
  }

  function updateCierre(field, value) {
    updateTraining((t) => ({ ...t, cierre: { ...t.cierre, [field]: value } }));
  }

  function addEjercicio() {
    updateTraining((t) => ({ ...t, ejercicios: [...(t.ejercicios || []), makeEjercicio()] }));
  }

  function removeLastEjercicio() {
    updateTraining((t) => {
      if ((t.ejercicios || []).length <= 1) return t;
      return { ...t, ejercicios: t.ejercicios.slice(0, -1) };
    });
  }

  function removeEjercicio(id) {
    updateTraining((t) => {
      if ((t.ejercicios || []).length <= 1) return t;
      return { ...t, ejercicios: t.ejercicios.filter((e) => e.id !== id) };
    });
  }

  function updateEjercicio(id, field, value) {
    updateTraining((t) => ({
      ...t,
      ejercicios: t.ejercicios.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));
  }

  function loadFromLibrary(ejercicioId, libExercise) {
    updateTraining((t) => {
      const updated = {
        ...t,
        ejercicios: t.ejercicios.map((e) =>
          e.id === ejercicioId
            ? {
                ...e,
                contenido: libExercise.contenido || e.contenido,
                descripcion: libExercise.descripcion || e.descripcion,
                tipoPista: libExercise.tipoPista || e.tipoPista,
                elementos: libExercise.elementos || [],
                libExerciseId: libExercise.id,
                libExerciseName: libExercise.nombre,
              }
            : e,
        ),
      };
      const idx = updated.ejercicios.findIndex((e) => e.id === ejercicioId);
      const nextEmpty = updated.ejercicios.find(
        (e, i) => i > idx && !e.contenido && !e.descripcion && !(e.elementos?.length > 0),
      );
      if (nextEmpty) {
        setLibraryPanel((prev) => ({ ...prev, targetId: nextEmpty.id }));
      }
      return updated;
    });
  }

  function saveToLibrary(ejercicio) {
    setLibraryPrompt(ejercicio);
  }

  async function handleLibrarySave(nombre) {
    const ejercicio = libraryPrompt;
    setLibraryPrompt(null);
    if (!ejercicio) return;
    await saveExercise(
      {
        id: crypto.randomUUID(),
        nombre,
        contenido: ejercicio.contenido,
        descripcion: ejercicio.descripcion,
        tipoPista: ejercicio.tipoPista,
        elementos: ejercicio.elementos || [],
      },
      { uid: user.uid, db, appId },
    );
  }

  const ejercicios = training?.ejercicios || [];
  const ejModal = ejercicios.find((e) => e.id === modalEjercicioId);
  const libraryAllTags = [...new Set(exercises.flatMap((ex) => ex.tags || []))].sort();
  const libraryFiltered = exercises.filter((ex) => {
    const matchesSearch =
      !librarySearch ||
      ex.nombre?.toLowerCase().includes(librarySearch.toLowerCase()) ||
      ex.contenido?.toLowerCase().includes(librarySearch.toLowerCase());
    const matchesTags =
      libraryFilterTags.length === 0 ||
      libraryFilterTags.every((tag) => (ex.tags || []).map((t) => t.toLowerCase()).includes(tag.toLowerCase()));
    return matchesSearch && matchesTags;
  });

  return {
    teamId,
    trainingId,
    navigate,
    team,
    profile,
    members,
    training,
    loading,
    saveStatus,
    ejercicios,
    ejModal,
    modalEjercicioId,
    setModalEjercicioId,
    libraryPrompt,
    setLibraryPrompt,
    activeTool,
    setActiveTool,
    libraryPanel,
    setLibraryPanel,
    librarySearch,
    setLibrarySearch,
    libraryFilterTags,
    setLibraryFilterTags,
    libraryAllTags,
    libraryFiltered,
    updateTraining,
    updateMeta,
    updateCierre,
    addEjercicio,
    removeLastEjercicio,
    removeEjercicio,
    updateEjercicio,
    loadFromLibrary,
    saveToLibrary,
    handleLibrarySave,
  };
}
