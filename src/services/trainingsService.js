import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { workspaceColRef, saveWorkspaceDoc, deleteWorkspaceDoc } from './firestoreHelpers';

function normalizeExerciseTags(ex) {
  if (Array.isArray(ex.tags) && ex.tags.length > 0) return ex;
  if (!ex.contenido) return { ...ex, tags: [] };
  return {
    ...ex,
    tags: ex.contenido
      .split(/[,;/\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
  };
}

function trainingsCol(teamId, wsId, db, appId) {
  return collection(db, 'artifacts', appId, 'workspaces', wsId, 'teams', teamId, 'trainings');
}

export function subscribeToTrainings(teamId, wsId, db, appId, callback) {
  const q = query(trainingsCol(teamId, wsId, db, appId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function saveTraining(training, teamId, { wsId, db, appId }) {
  const ref = doc(trainingsCol(teamId, wsId, db, appId), training.id);
  await setDoc(
    ref,
    {
      ...training,
      updatedAt: serverTimestamp(),
      ...(training.createdAt ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

export async function deleteTraining(trainingId, teamId, { wsId, db, appId }) {
  await deleteDoc(doc(trainingsCol(teamId, wsId, db, appId), trainingId));
}

export function subscribeToExercises(wsId, db, appId, callback) {
  const q = query(workspaceColRef(db, appId, wsId, 'exercises'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalizeExerciseTags({ ...d.data(), id: d.id })));
  });
}

export async function saveExercise(exercise, { wsId, db, appId }) {
  const toSave = { ...exercise };
  if (Array.isArray(toSave.tags)) {
    toSave.contenido = toSave.tags.join(', ');
  }
  await saveWorkspaceDoc(db, appId, wsId, ['exercises', toSave.id], toSave);
}

export async function deleteExercise(exerciseId, { wsId, db, appId }) {
  await deleteWorkspaceDoc(db, appId, wsId, ['exercises', exerciseId]);
}

// Minimal-write helper for favoriting; avoids round-tripping the whole exercise doc.
export async function setFavorite(exerciseId, favorite, { wsId, db, appId }) {
  const ref = doc(workspaceColRef(db, appId, wsId, 'exercises'), exerciseId);
  await setDoc(ref, { favorite: !!favorite, updatedAt: serverTimestamp() }, { merge: true });
}

// Propagates edits of a library exercise to every training that references it.
export async function propagateExerciseUpdate(exercise, { wsId, db, appId }) {
  const teamsSnap = await getDocs(workspaceColRef(db, appId, wsId, 'teams'));
  for (const teamDoc of teamsSnap.docs) {
    const trainingsSnap = await getDocs(trainingsCol(teamDoc.id, wsId, db, appId));
    for (const trainingDoc of trainingsSnap.docs) {
      const ejercicios = trainingDoc.data().ejercicios || [];
      if (!ejercicios.some((e) => e.libExerciseId === exercise.id)) continue;
      const updated = ejercicios.map((e) =>
        e.libExerciseId !== exercise.id
          ? e
          : {
              ...e,
              contenido: exercise.contenido,
              descripcion: exercise.descripcion,
              tipoPista: exercise.tipoPista,
              elementos: exercise.elementos || [],
              pasos: exercise.pasos || [],
              libExerciseName: exercise.nombre,
            },
      );
      await setDoc(trainingDoc.ref, { ejercicios: updated, updatedAt: serverTimestamp() }, { merge: true });
    }
  }
}
