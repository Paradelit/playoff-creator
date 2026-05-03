import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore';

function calendarSessionsCol(wsId, db, appId) {
  return collection(db, 'artifacts', appId, 'workspaces', wsId, 'calendarSessions');
}

export function subscribeToCalendarSessions(wsId, db, appId, startDate, endDate, callback) {
  const q = query(
    calendarSessionsCol(wsId, db, appId),
    where('fecha', '>=', startDate),
    where('fecha', '<=', endDate),
    orderBy('fecha', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function saveCalendarSession(session, { wsId, db, appId }) {
  const ref = doc(calendarSessionsCol(wsId, db, appId), session.id);
  await setDoc(
    ref,
    {
      ...session,
      updatedAt: serverTimestamp(),
      ...(session.createdAt ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

export async function deleteCalendarSession(sessionId, { wsId, db, appId }) {
  await deleteDoc(doc(calendarSessionsCol(wsId, db, appId), sessionId));
}

export async function bulkImportCalendarSessions(sessions, { wsId, db, appId }) {
  await Promise.all(
    sessions.map((s) => saveCalendarSession({ ...s, id: s.id || crypto.randomUUID() }, { wsId, db, appId })),
  );
}

export async function getCalendarSessionsInRange(wsId, db, appId, startDate, endDate) {
  const q = query(
    calendarSessionsCol(wsId, db, appId),
    where('fecha', '>=', startDate),
    where('fecha', '<=', endDate),
    orderBy('fecha', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function deleteCalendarSessionsByTeamAndRange(teamIds, startDate, endDate, { wsId, db, appId }) {
  const existing = await getCalendarSessionsInRange(wsId, db, appId, startDate, endDate);
  const toDelete = existing.filter((s) => teamIds.includes(s.teamId));
  await Promise.all(toDelete.map((s) => deleteCalendarSession(s.id, { wsId, db, appId })));
}

export function subscribeToTeamSessions(wsId, db, appId, teamId, tipo, callback) {
  const q = query(
    calendarSessionsCol(wsId, db, appId),
    where('teamId', '==', teamId),
    where('tipo', '==', tipo),
    orderBy('fecha', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function linkTrainingToSession(sessionId, trainingId, { wsId, db, appId }) {
  const ref = doc(calendarSessionsCol(wsId, db, appId), sessionId);
  await setDoc(ref, { trainingId, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getSessionsByRecurrenceId(wsId, db, appId, recurrenceId, fromDate) {
  const q = query(calendarSessionsCol(wsId, db, appId), where('recurrenceId', '==', recurrenceId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id }))
    .filter((s) => s.fecha >= fromDate)
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
}

export async function batchUpdateCalendarSessions(sessions, fields, { wsId, db, appId }) {
  await Promise.all(
    sessions.map((s) =>
      setDoc(
        doc(calendarSessionsCol(wsId, db, appId), s.id),
        { ...fields, updatedAt: serverTimestamp() },
        { merge: true },
      ),
    ),
  );
}

export function subscribeToAllTrainingSessions(wsId, db, appId, startDate, endDate, callback) {
  const q = query(
    calendarSessionsCol(wsId, db, appId),
    where('fecha', '>=', startDate),
    where('fecha', '<=', endDate),
    orderBy('fecha', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    const all = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    callback(all.filter((s) => s.tipo === 'entrenamiento'));
  });
}

export async function deleteSessionsByRecurrenceId(wsId, db, appId, recurrenceId, fromDate) {
  const sessions = await getSessionsByRecurrenceId(wsId, db, appId, recurrenceId, fromDate);
  await Promise.all(sessions.map((s) => deleteCalendarSession(s.id, { wsId, db, appId })));
  return sessions;
}
