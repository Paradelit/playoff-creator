import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { userColRef, saveUserDoc } from './firestoreHelpers';
import { deleteTeamCascade } from './dataCleanupService';

function membersCol(teamId, uid, db, appId) {
  return collection(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'members');
}

export function subscribeToTeams(uid, db, appId, callback) {
  const q = query(userColRef(db, appId, uid, 'teams'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function saveTeam(team, { uid, db, appId }) {
  await saveUserDoc(db, appId, uid, 'teams', team.id, team);
}

export async function deleteTeam(teamId, { appId }) {
  await deleteTeamCascade({ appId, teamId });
}

export function subscribeToMembers(teamId, uid, db, appId, callback) {
  const q = query(membersCol(teamId, uid, db, appId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

/**
 * Subscribe to members across many teams in one call. Each member is tagged
 * with `teamId` so consumers can join back. Calls `callback` with the merged
 * array whenever any team's roster changes.
 */
export function subscribeToAllMembers(teams, uid, db, appId, callback) {
  if (!Array.isArray(teams) || teams.length === 0) {
    callback([]);
    return () => undefined;
  }
  const byTeam = new Map();
  function emit() {
    const all = [];
    for (const [teamId, list] of byTeam.entries()) {
      for (const m of list) all.push({ ...m, teamId });
    }
    callback(all);
  }
  const unsubs = teams.map((t) => {
    const q = query(membersCol(t.id, uid, db, appId), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      byTeam.set(
        t.id,
        snap.docs.map((d) => ({ ...d.data(), id: d.id })),
      );
      emit();
    });
  });
  return () => unsubs.forEach((u) => u());
}

export async function saveMember(member, teamId, { uid, db, appId }) {
  const ref = doc(membersCol(teamId, uid, db, appId), member.id);
  await setDoc(
    ref,
    {
      ...member,
      updatedAt: serverTimestamp(),
      ...(member.createdAt ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

export async function deleteMember(memberId, teamId, { uid, db, appId }) {
  await deleteDoc(doc(membersCol(teamId, uid, db, appId), memberId));
}

// ── Jugadores interesantes (por equipo) ─────────────────────────────────────
function jugadoresDoc(teamId, uid, db, appId) {
  return doc(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'cuaderno', 'jugadores');
}

export function subscribeToTeamJugadores(teamId, uid, db, appId, callback) {
  return onSnapshot(jugadoresDoc(teamId, uid, db, appId), (snap) => {
    callback(snap.exists() ? (snap.data().lista ?? []) : []);
  });
}

export async function saveTeamJugadores(teamId, lista, { uid, db, appId }) {
  await setDoc(jugadoresDoc(teamId, uid, db, appId), { lista, updatedAt: serverTimestamp() });
}

// ── Test de tiro (por equipo) ────────────────────────────────────────────────
function testTiroDoc(teamId, uid, db, appId) {
  return doc(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'cuaderno', 'test-tiro');
}

export function subscribeToTestTiro(teamId, uid, db, appId, callback) {
  return onSnapshot(testTiroDoc(teamId, uid, db, appId), (snap) => {
    callback(snap.exists() ? (snap.data().tables ?? null) : null);
  });
}

export async function saveTestTiro(teamId, tables, { uid, db, appId }) {
  await setDoc(testTiroDoc(teamId, uid, db, appId), { tables, updatedAt: serverTimestamp() });
}

// ── Asistencia (por equipo) ─────────────────────────────────────────────────
function asistenciaDoc(teamId, uid, db, appId) {
  return doc(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'cuaderno', 'asistencia');
}

export function subscribeToAsistencia(teamId, uid, db, appId, callback) {
  return onSnapshot(asistenciaDoc(teamId, uid, db, appId), (snap) => {
    callback(snap.exists() ? snap.data() : { attendance: {}, manualSessions: {} });
  });
}

export async function saveAsistencia(teamId, data, { uid, db, appId }) {
  await setDoc(asistenciaDoc(teamId, uid, db, appId), { ...data, updatedAt: serverTimestamp() });
}

// ── Informe jugadores (por equipo) ──────────────────────────────────────────
function informeJugadoresDoc(teamId, uid, db, appId) {
  return doc(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'cuaderno', 'informe-jugadores');
}

export function subscribeToInformeJugadores(teamId, uid, db, appId, callback) {
  return onSnapshot(informeJugadoresDoc(teamId, uid, db, appId), (snap) => {
    if (!snap.exists()) {
      callback({ rows: [], observaciones: '' });
      return;
    }
    const data = snap.data();
    callback({
      rows: Array.isArray(data.rows) ? data.rows : [],
      observaciones: typeof data.observaciones === 'string' ? data.observaciones : '',
    });
  });
}

export async function saveInformeJugadores(teamId, payload, { uid, db, appId }) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const observaciones = typeof payload?.observaciones === 'string' ? payload.observaciones : '';
  await setDoc(informeJugadoresDoc(teamId, uid, db, appId), {
    rows,
    observaciones,
    updatedAt: serverTimestamp(),
  });
}

// ── Notas del cuaderno (por equipo) ─────────────────────────────────────────
function notasDoc(teamId, uid, db, appId) {
  return doc(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'cuaderno', 'notas');
}

export function subscribeToTeamNotes(teamId, uid, db, appId, callback) {
  return onSnapshot(notasDoc(teamId, uid, db, appId), (snap) => {
    callback(snap.exists() ? (snap.data().texto ?? '') : '');
  });
}

export async function saveTeamNotes(teamId, texto, { uid, db, appId }) {
  await setDoc(notasDoc(teamId, uid, db, appId), { texto, updatedAt: serverTimestamp() });
}
