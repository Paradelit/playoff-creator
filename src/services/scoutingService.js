import { onSnapshot } from 'firebase/firestore';
import { workspaceDocRef, saveWorkspaceDoc, deleteWorkspaceDoc } from './firestoreHelpers';

export function subscribeToScouting(sessionId, { wsId, db, appId }, callback) {
  const ref = workspaceDocRef(db, appId, wsId, 'scoutings', sessionId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { ...snap.data(), id: snap.id } : null);
  });
}

export async function saveScouting(data, sessionId, { wsId, db, appId }) {
  await saveWorkspaceDoc(db, appId, wsId, ['scoutings', sessionId], data);
}

export async function deleteScouting(sessionId, { wsId, db, appId }) {
  await deleteWorkspaceDoc(db, appId, wsId, ['scoutings', sessionId]);
}
