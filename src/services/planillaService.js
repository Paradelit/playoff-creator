import { onSnapshot } from 'firebase/firestore';
import { userDocRef, saveUserDoc, deleteUserDoc } from './firestoreHelpers';

export function subscribeToPlanilla(sessionId, { uid, db, appId }, callback) {
  const ref = userDocRef(db, appId, uid, 'planillas', sessionId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { ...snap.data(), id: snap.id } : null);
  });
}

export async function savePlanilla(data, sessionId, { uid, db, appId }) {
  await saveUserDoc(db, appId, uid, 'planillas', sessionId, data);
}

export async function deletePlanilla(sessionId, { uid, db, appId }) {
  await deleteUserDoc(db, appId, uid, 'planillas', sessionId);
}
