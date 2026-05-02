import { onSnapshot } from 'firebase/firestore';
import { workspaceDocRef, saveWorkspaceDoc, deleteWorkspaceDoc } from './firestoreHelpers';

export function subscribeToPlanilla(sessionId, { wsId, db, appId }, callback) {
  const ref = workspaceDocRef(db, appId, wsId, 'planillas', sessionId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { ...snap.data(), id: snap.id } : null);
  });
}

export async function savePlanilla(data, sessionId, { wsId, db, appId }) {
  await saveWorkspaceDoc(db, appId, wsId, ['planillas', sessionId], data);
}

export async function deletePlanilla(sessionId, { wsId, db, appId }) {
  await deleteWorkspaceDoc(db, appId, wsId, ['planillas', sessionId]);
}
