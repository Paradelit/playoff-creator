import { onSnapshot } from 'firebase/firestore';
import { userDocRef, saveUserDoc, deleteUserDoc } from './firestoreHelpers';

export function subscribeToScouting(sessionId, { uid, db, appId }, callback) {
  const ref = userDocRef(db, appId, uid, 'scoutings', sessionId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { ...snap.data(), id: snap.id } : null);
  });
}

export async function saveScouting(data, sessionId, { uid, db, appId }) {
  await saveUserDoc(db, appId, uid, 'scoutings', sessionId, data);
}

export async function deleteScouting(sessionId, { uid, db, appId }) {
  await deleteUserDoc(db, appId, uid, 'scoutings', sessionId);
}
