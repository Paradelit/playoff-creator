import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

function userBasePath(uid, appId) {
  return ['artifacts', appId, 'users', uid];
}

function workspaceBasePath(wsId, appId) {
  return ['artifacts', appId, 'workspaces', wsId];
}

function stripTimestamps(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const { updatedAt: _updatedAt, createdAt: _createdAt, ...rest } = record;
  return rest;
}

async function readCollection(db, ...path) {
  const snap = await getDocs(collection(db, ...path));
  return snap.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }));
}

async function writeCollectionDocs(db, path, items) {
  for (const item of items || []) {
    if (!item?.id) continue;
    await setDoc(doc(db, ...path, item.id), stripTimestamps(item), { merge: true });
  }
}

// ── Export helpers ──────────────────────────────────────────────────────────

async function exportTeamBundles(db, base, teams) {
  const members = {};
  const trainings = {};
  const cuaderno = {};

  for (const team of teams) {
    members[team.id] = await readCollection(db, ...base, 'teams', team.id, 'members');
    trainings[team.id] = await readCollection(db, ...base, 'teams', team.id, 'trainings');

    const cuadernoSnap = await getDocs(collection(db, ...base, 'teams', team.id, 'cuaderno'));
    cuaderno[team.id] = Object.fromEntries(cuadernoSnap.docs.map((docSnap) => [docSnap.id, docSnap.data()]));
  }

  return { members, trainings, cuaderno };
}

async function exportTopLevelCollections(db, base) {
  const [exercises, calendarSessions, brackets, scoutings, analisis, planillas] = await Promise.all([
    readCollection(db, ...base, 'exercises'),
    readCollection(db, ...base, 'calendarSessions'),
    readCollection(db, ...base, 'brackets'),
    readCollection(db, ...base, 'scoutings'),
    readCollection(db, ...base, 'analisis'),
    readCollection(db, ...base, 'planillas'),
  ]);

  return { exercises, calendarSessions, brackets, scoutings, analisis, planillas };
}

async function exportSharedBrackets(db, appId, uid) {
  const sharedSnap = await getDocs(
    query(collection(db, 'artifacts', appId, 'shared'), where('shareConfig.ownerId', '==', uid)),
  );
  return Object.fromEntries(
    sharedSnap.docs.map((docSnap) => [docSnap.id, { ...docSnap.data(), shareCode: docSnap.id }]),
  );
}

// ── Import helpers ─────────────────────────────────────────────────────────

function normalizeCuadernoDocs(rawCuaderno, version) {
  if (version >= 2) return rawCuaderno || {};

  return Object.fromEntries(
    Object.entries(rawCuaderno || {}).map(([docId, docData]) => [docId, stripTimestamps(docData)]),
  );
}

async function importTeamBundle(db, base, team, data, version) {
  if (!team?.id) return;

  await setDoc(doc(db, ...base, 'teams', team.id), stripTimestamps(team), { merge: true });
  await writeCollectionDocs(db, [...base, 'teams', team.id, 'members'], data?.members?.[team.id]);
  await writeCollectionDocs(db, [...base, 'teams', team.id, 'trainings'], data?.trainings?.[team.id]);

  const cuadernoDocs = normalizeCuadernoDocs(data?.cuaderno?.[team.id], version);
  for (const [docId, docData] of Object.entries(cuadernoDocs)) {
    await setDoc(doc(db, ...base, 'teams', team.id, 'cuaderno', docId), stripTimestamps(docData), { merge: true });
  }
}

async function importTopLevelCollections(db, base, data) {
  const collectionsToImport = [
    ['exercises', data?.exercises],
    ['calendarSessions', data?.calendarSessions],
    ['brackets', data?.brackets],
    ['scoutings', data?.scoutings],
    ['analisis', data?.analisis],
    ['planillas', data?.planillas],
  ];

  for (const [collectionName, items] of collectionsToImport) {
    await writeCollectionDocs(db, [...base, collectionName], items);
  }
}

async function importSharedBrackets(db, appId, sharedBrackets) {
  for (const [shareCode, sharedBracket] of Object.entries(sharedBrackets || {})) {
    if (!shareCode) continue;
    await setDoc(doc(db, 'artifacts', appId, 'shared', shareCode), stripTimestamps(sharedBracket), { merge: true });
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function exportUserData(uid, wsId, db, appId) {
  const userBase = userBasePath(uid, appId);
  const wsBase = workspaceBasePath(wsId, appId);

  const profileSnap = await getDoc(doc(db, ...userBase, 'profile', 'main'));
  const profile = profileSnap.exists() ? profileSnap.data() : {};
  const teams = await readCollection(db, ...wsBase, 'teams');
  const { members, trainings, cuaderno } = await exportTeamBundles(db, wsBase, teams);
  const topLevelCollections = await exportTopLevelCollections(db, wsBase);
  const sharedBrackets = await exportSharedBrackets(db, appId, uid);

  return {
    version: 2,
    exportDate: new Date().toISOString(),
    profile,
    teams,
    members,
    trainings,
    cuaderno,
    ...topLevelCollections,
    sharedBrackets,
  };
}

export async function importUserData(data, { uid, wsId, db, appId }) {
  const userBase = userBasePath(uid, appId);
  const wsBase = workspaceBasePath(wsId, appId);
  const version = Number(data?.version || 1);

  if (data?.profile && Object.keys(data.profile).length > 0) {
    await setDoc(doc(db, ...userBase, 'profile', 'main'), stripTimestamps(data.profile), { merge: true });
  }

  for (const team of data?.teams || []) {
    await importTeamBundle(db, wsBase, team, data, version);
  }

  await importTopLevelCollections(db, wsBase, data);
  await importSharedBrackets(db, appId, data?.sharedBrackets);
}
