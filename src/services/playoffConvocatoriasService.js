import { collection, doc, setDoc, onSnapshot, serverTimestamp, getDocs, query } from 'firebase/firestore';

function col(wsId, db, appId) {
  return collection(db, 'artifacts', appId, 'workspaces', wsId, 'playoffConvocatorias');
}

export function subscribeToPlayoffConvocatorias(wsId, db, appId, callback) {
  return onSnapshot(query(col(wsId, db, appId)), (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function getPlayoffConvocatorias(wsId, db, appId) {
  const snap = await getDocs(query(col(wsId, db, appId)));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function savePlayoffConvocatoria(payload, { wsId, db, appId }) {
  const ref = doc(col(wsId, db, appId), payload.sessionId);
  await setDoc(
    ref,
    { ...payload, updatedAt: serverTimestamp(), ...(payload.createdAt ? {} : { createdAt: serverTimestamp() }) },
    { merge: true },
  );
}
