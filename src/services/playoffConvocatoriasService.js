import { collection, doc, setDoc, onSnapshot, serverTimestamp, getDocs, query } from 'firebase/firestore';

function col(uid, db, appId) {
  return collection(db, 'artifacts', appId, 'users', uid, 'playoffConvocatorias');
}

export function subscribeToPlayoffConvocatorias(uid, db, appId, callback) {
  return onSnapshot(query(col(uid, db, appId)), (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function getPlayoffConvocatorias(uid, db, appId) {
  const snap = await getDocs(query(col(uid, db, appId)));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function savePlayoffConvocatoria(payload, { uid, db, appId }) {
  const ref = doc(col(uid, db, appId), payload.sessionId);
  await setDoc(
    ref,
    { ...payload, updatedAt: serverTimestamp(), ...(payload.createdAt ? {} : { createdAt: serverTimestamp() }) },
    { merge: true },
  );
}
