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

function calendarSessionsCol(uid, db, appId) {
  return collection(db, 'artifacts', appId, 'users', uid, 'calendarSessions');
}

export function subscribeToCalendarSessions(uid, db, appId, startDate, endDate, callback) {
  const q = query(
    calendarSessionsCol(uid, db, appId),
    where('fecha', '>=', startDate),
    where('fecha', '<=', endDate),
    orderBy('fecha', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function saveCalendarSession(session, { uid, db, appId }) {
  const ref = doc(calendarSessionsCol(uid, db, appId), session.id);
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

export async function deleteCalendarSession(sessionId, { uid, db, appId }) {
  await deleteDoc(doc(calendarSessionsCol(uid, db, appId), sessionId));
}

export async function bulkImportCalendarSessions(sessions, { uid, db, appId }) {
  await Promise.all(
    sessions.map((s) => saveCalendarSession({ ...s, id: s.id || crypto.randomUUID() }, { uid, db, appId })),
  );
}

export async function getCalendarSessionsInRange(uid, db, appId, startDate, endDate) {
  const q = query(
    calendarSessionsCol(uid, db, appId),
    where('fecha', '>=', startDate),
    where('fecha', '<=', endDate),
    orderBy('fecha', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function deleteCalendarSessionsByTeamAndRange(teamIds, startDate, endDate, { uid, db, appId }) {
  const existing = await getCalendarSessionsInRange(uid, db, appId, startDate, endDate);
  const toDelete = existing.filter((s) => teamIds.includes(s.teamId));
  await Promise.all(toDelete.map((s) => deleteCalendarSession(s.id, { uid, db, appId })));
}

export function subscribeToTeamSessions(uid, db, appId, teamId, tipo, callback) {
  const q = query(
    calendarSessionsCol(uid, db, appId),
    where('teamId', '==', teamId),
    where('tipo', '==', tipo),
    orderBy('fecha', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function linkTrainingToSession(sessionId, trainingId, { uid, db, appId }) {
  const ref = doc(calendarSessionsCol(uid, db, appId), sessionId);
  await setDoc(ref, { trainingId, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getSessionsByRecurrenceId(uid, db, appId, recurrenceId, fromDate) {
  const q = query(calendarSessionsCol(uid, db, appId), where('recurrenceId', '==', recurrenceId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id }))
    .filter((s) => s.fecha >= fromDate)
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
}

export async function batchUpdateCalendarSessions(sessions, fields, { uid, db, appId }) {
  await Promise.all(
    sessions.map((s) =>
      setDoc(
        doc(calendarSessionsCol(uid, db, appId), s.id),
        { ...fields, updatedAt: serverTimestamp() },
        { merge: true },
      ),
    ),
  );
}

export function subscribeToAllTrainingSessions(uid, db, appId, startDate, endDate, callback) {
  const q = query(
    calendarSessionsCol(uid, db, appId),
    where('fecha', '>=', startDate),
    where('fecha', '<=', endDate),
    orderBy('fecha', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    const all = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    callback(all.filter((s) => s.tipo === 'entrenamiento'));
  });
}

export async function deleteSessionsByRecurrenceId(uid, db, appId, recurrenceId, fromDate) {
  const sessions = await getSessionsByRecurrenceId(uid, db, appId, recurrenceId, fromDate);
  await Promise.all(sessions.map((s) => deleteCalendarSession(s.id, { uid, db, appId })));
  return sessions;
}
