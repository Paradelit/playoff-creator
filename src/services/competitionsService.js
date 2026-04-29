import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';

function competitionsCol(teamId, uid, db, appId) {
  return collection(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'competitions');
}

export function subscribeToCompetitions(teamId, uid, db, appId, callback) {
  const q = query(competitionsCol(teamId, uid, db, appId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function saveCompetition(competition, teamId, { uid, db, appId }) {
  const ref = doc(competitionsCol(teamId, uid, db, appId), competition.id);
  await setDoc(
    ref,
    {
      ...competition,
      updatedAt: serverTimestamp(),
      ...(competition.createdAt ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

export async function deleteCompetition(competitionId, teamId, { uid, db, appId }) {
  await deleteDoc(doc(competitionsCol(teamId, uid, db, appId), competitionId));
}
