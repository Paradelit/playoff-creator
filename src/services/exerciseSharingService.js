import { doc, getDoc, setDoc, serverTimestamp, collection } from 'firebase/firestore';

function sharedExercisesCol(db, appId) {
  return collection(db, 'artifacts', appId, 'shared-exercises');
}

function generateShareCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export async function shareExercise(exercise, { db, appId, uid, displayName }) {
  const shareCode = generateShareCode();
  const ref = doc(sharedExercisesCol(db, appId), shareCode);
  await setDoc(ref, {
    nombre: exercise.nombre,
    tags: exercise.tags || [],
    contenido: exercise.contenido || '',
    descripcion: exercise.descripcion || '',
    tipoPista: exercise.tipoPista || 'media',
    elementos: exercise.elementos || [],
    sharedBy: { uid, displayName: displayName || 'Anónimo' },
    sharedAt: serverTimestamp(),
  });
  return shareCode;
}

export async function getSharedExercise(shareCode, { db, appId }) {
  const ref = doc(sharedExercisesCol(db, appId), shareCode);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
