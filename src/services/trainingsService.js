import {
  collection, doc, setDoc, deleteDoc, getDocs,
  onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore';

function trainingsCol(teamId, uid, db, appId) {
  return collection(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'trainings');
}

function exercisesCol(uid, db, appId) {
  return collection(db, 'artifacts', appId, 'users', uid, 'exercises');
}

export function subscribeToTrainings(teamId, uid, db, appId, callback) {
  const q = query(trainingsCol(teamId, uid, db, appId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id })));
  });
}

export async function saveTraining(training, teamId, { uid, db, appId }) {
  const ref = doc(trainingsCol(teamId, uid, db, appId), training.id);
  await setDoc(ref, {
    ...training,
    updatedAt: serverTimestamp(),
    ...(training.createdAt ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });
}

export async function deleteTraining(trainingId, teamId, { uid, db, appId }) {
  await deleteDoc(doc(trainingsCol(teamId, uid, db, appId), trainingId));
}

export function subscribeToExercises(uid, db, appId, callback) {
  const q = query(exercisesCol(uid, db, appId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id })));
  });
}

export async function saveExercise(exercise, { uid, db, appId }) {
  const ref = doc(exercisesCol(uid, db, appId), exercise.id);
  await setDoc(ref, {
    ...exercise,
    updatedAt: serverTimestamp(),
    ...(exercise.createdAt ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });
}

export async function deleteExercise(exerciseId, { uid, db, appId }) {
  await deleteDoc(doc(exercisesCol(uid, db, appId), exerciseId));
}

// Propagates edits of a library exercise to every training that references it.
export async function propagateExerciseUpdate(exercise, { uid, db, appId }) {
  const teamsSnap = await getDocs(collection(db, 'artifacts', appId, 'users', uid, 'teams'));
  for (const teamDoc of teamsSnap.docs) {
    const trainingsSnap = await getDocs(trainingsCol(teamDoc.id, uid, db, appId));
    for (const trainingDoc of trainingsSnap.docs) {
      const ejercicios = trainingDoc.data().ejercicios || [];
      if (!ejercicios.some(e => e.libExerciseId === exercise.id)) continue;
      const updated = ejercicios.map(e => e.libExerciseId !== exercise.id ? e : {
        ...e,
        contenido: exercise.contenido,
        descripcion: exercise.descripcion,
        tipoPista: exercise.tipoPista,
        elementos: exercise.elementos || [],
        libExerciseName: exercise.nombre,
      });
      await setDoc(trainingDoc.ref, { ejercicios: updated, updatedAt: serverTimestamp() }, { merge: true });
    }
  }
}
