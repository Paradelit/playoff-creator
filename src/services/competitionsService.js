import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';

function competitionsCol(teamId, wsId, db, appId) {
  return collection(db, 'artifacts', appId, 'workspaces', wsId, 'teams', teamId, 'competitions');
}

export function subscribeToCompetitions(teamId, wsId, db, appId, callback) {
  const q = query(competitionsCol(teamId, wsId, db, appId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function saveCompetition(competition, teamId, { wsId, db, appId }) {
  const ref = doc(competitionsCol(teamId, wsId, db, appId), competition.id);
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

export async function deleteCompetition(competitionId, teamId, { wsId, db, appId }) {
  await deleteDoc(doc(competitionsCol(teamId, wsId, db, appId), competitionId));
}
