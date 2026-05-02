import { onSnapshot } from 'firebase/firestore';
import { workspaceDocRef, saveWorkspaceDoc, deleteWorkspaceDoc } from './firestoreHelpers';

export function subscribeToAnalysis(sessionId, { wsId, db, appId }, callback) {
  const ref = workspaceDocRef(db, appId, wsId, 'analisis', sessionId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { ...snap.data(), id: snap.id } : null);
  });
}

export async function saveAnalysis(data, sessionId, { wsId, db, appId }) {
  await saveWorkspaceDoc(db, appId, wsId, ['analisis', sessionId], data);
}

export async function deleteAnalysis(sessionId, { wsId, db, appId }) {
  await deleteWorkspaceDoc(db, appId, wsId, ['analisis', sessionId]);
}
