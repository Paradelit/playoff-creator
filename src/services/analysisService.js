import { onSnapshot } from 'firebase/firestore';
import { userDocRef, saveUserDoc, deleteUserDoc } from './firestoreHelpers';

export function subscribeToAnalysis(sessionId, { uid, db, appId }, callback) {
  const ref = userDocRef(db, appId, uid, 'analisis', sessionId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { ...snap.data(), id: snap.id } : null);
  });
}

export async function saveAnalysis(data, sessionId, { uid, db, appId }) {
  await saveUserDoc(db, appId, uid, 'analisis', sessionId, data);
}

export async function deleteAnalysis(sessionId, { uid, db, appId }) {
  await deleteUserDoc(db, appId, uid, 'analisis', sessionId);
}
