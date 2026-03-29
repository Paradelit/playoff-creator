import {
  collection, doc, setDoc, deleteDoc,
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
