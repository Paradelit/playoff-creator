import {
  collection,
  doc,
  documentId,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { workspaceColRef, saveWorkspaceDoc } from './firestoreHelpers';
import { deleteTeamCascade } from './dataCleanupService';

function membersCol(teamId, wsId, db, appId) {
  return collection(db, 'artifacts', appId, 'workspaces', wsId, 'teams', teamId, 'members');
}

/**
 * Subscribe to teams visible to the caller.
 *
 * `scope` controls the query:
 * - `{ scope: 'all' }` — all teams of the workspace (owner / personal owner).
 * - `{ scope: 'assigned', assignedTeamIds: [...] }` — only teams in the array.
 *   Required for non-owner members in club workspaces (sub-3 visibility
 *   scoping). If `assignedTeamIds` is empty, calls back with [] without
 *   subscribing — Firestore rejects `where(documentId(), 'in', [])`.
 *
 * Legacy callers without `scope` default to `'all'` (preserves personal
 * workspace behavior, which is the only path that hit this before sub-3).
 */
export function subscribeToTeams(wsId, db, appId, callback, scope = { scope: 'all' }) {
  const teamsCol = workspaceColRef(db, appId, wsId, 'teams');
  if (scope.scope === 'assigned') {
    const ids = Array.isArray(scope.assignedTeamIds) ? scope.assignedTeamIds : [];
    if (ids.length === 0) {
      callback([]);
      return () => undefined;
    }
    const q = query(teamsCol, where(documentId(), 'in', ids));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    });
  }
  const q = query(teamsCol, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

export async function saveTeam(team, { wsId, db, appId }) {
  await saveWorkspaceDoc(db, appId, wsId, ['teams', team.id], team);
}

export async function deleteTeam(teamId, { appId, wsId }) {
  await deleteTeamCascade({ appId, wsId, teamId });
}

export function subscribeToMembers(teamId, wsId, db, appId, callback) {
  const q = query(membersCol(teamId, wsId, db, appId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
}

/**
 * Subscribe to members across many teams in one call. Each member is tagged
 * with `teamId` so consumers can join back. Calls `callback` with the merged
 * array whenever any team's roster changes.
 */
export function subscribeToAllMembers(teams, wsId, db, appId, callback) {
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
    const q = query(membersCol(t.id, wsId, db, appId), orderBy('createdAt', 'asc'));
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

export async function saveMember(member, teamId, { wsId, db, appId }) {
  const ref = doc(membersCol(teamId, wsId, db, appId), member.id);
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

export async function deleteMember(memberId, teamId, { wsId, db, appId }) {
  await deleteDoc(doc(membersCol(teamId, wsId, db, appId), memberId));
}

// ── Jugadores interesantes (por equipo) ─────────────────────────────────────
function jugadoresDoc(teamId, wsId, db, appId) {
  return doc(db, 'artifacts', appId, 'workspaces', wsId, 'teams', teamId, 'cuaderno', 'jugadores');
}

export function subscribeToTeamJugadores(teamId, wsId, db, appId, callback) {
  return onSnapshot(jugadoresDoc(teamId, wsId, db, appId), (snap) => {
    callback(snap.exists() ? (snap.data().lista ?? []) : []);
  });
}

export async function saveTeamJugadores(teamId, lista, { wsId, db, appId }) {
  await setDoc(jugadoresDoc(teamId, wsId, db, appId), { lista, updatedAt: serverTimestamp() });
}

// ── Test de tiro (por equipo) ────────────────────────────────────────────────
function testTiroDoc(teamId, wsId, db, appId) {
  return doc(db, 'artifacts', appId, 'workspaces', wsId, 'teams', teamId, 'cuaderno', 'test-tiro');
}

export function subscribeToTestTiro(teamId, wsId, db, appId, callback) {
  return onSnapshot(testTiroDoc(teamId, wsId, db, appId), (snap) => {
    callback(snap.exists() ? (snap.data().tables ?? null) : null);
  });
}

export async function saveTestTiro(teamId, tables, { wsId, db, appId }) {
  await setDoc(testTiroDoc(teamId, wsId, db, appId), { tables, updatedAt: serverTimestamp() });
}

// ── Asistencia (por equipo) ─────────────────────────────────────────────────
function asistenciaDoc(teamId, wsId, db, appId) {
  return doc(db, 'artifacts', appId, 'workspaces', wsId, 'teams', teamId, 'cuaderno', 'asistencia');
}

export function subscribeToAsistencia(teamId, wsId, db, appId, callback) {
  return onSnapshot(asistenciaDoc(teamId, wsId, db, appId), (snap) => {
    callback(snap.exists() ? snap.data() : { attendance: {}, manualSessions: {} });
  });
}

export async function saveAsistencia(teamId, data, { wsId, db, appId }) {
  await setDoc(asistenciaDoc(teamId, wsId, db, appId), { ...data, updatedAt: serverTimestamp() });
}

// ── Informe jugadores (por equipo) ──────────────────────────────────────────
function informeJugadoresDoc(teamId, wsId, db, appId) {
  return doc(db, 'artifacts', appId, 'workspaces', wsId, 'teams', teamId, 'cuaderno', 'informe-jugadores');
}

export function subscribeToInformeJugadores(teamId, wsId, db, appId, callback) {
  return onSnapshot(informeJugadoresDoc(teamId, wsId, db, appId), (snap) => {
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

export async function saveInformeJugadores(teamId, payload, { wsId, db, appId }) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const observaciones = typeof payload?.observaciones === 'string' ? payload.observaciones : '';
  await setDoc(informeJugadoresDoc(teamId, wsId, db, appId), {
    rows,
    observaciones,
    updatedAt: serverTimestamp(),
  });
}

// ── Notas del cuaderno (por equipo) ─────────────────────────────────────────
function notasDoc(teamId, wsId, db, appId) {
  return doc(db, 'artifacts', appId, 'workspaces', wsId, 'teams', teamId, 'cuaderno', 'notas');
}

export function subscribeToTeamNotes(teamId, wsId, db, appId, callback) {
  return onSnapshot(notasDoc(teamId, wsId, db, appId), (snap) => {
    callback(snap.exists() ? (snap.data().texto ?? '') : '');
  });
}

export async function saveTeamNotes(teamId, texto, { wsId, db, appId }) {
  await setDoc(notasDoc(teamId, wsId, db, appId), { texto, updatedAt: serverTimestamp() });
}
