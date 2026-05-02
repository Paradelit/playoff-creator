import admin from 'firebase-admin';
import { copyCollection } from './copyCollection.js';
import { copyTeamsRecursive } from './copyTeams.js';
import { moveConversationsToPickHistory } from './conversationsMove.js';
import { addWsIdToNotifications } from './notifsWsId.js';
import { verifyMigration, countDocsRecursive } from './verify.js';

async function findExistingPersonal(db, appId, uid) {
  const snap = await db
    .collection(`artifacts/${appId}/workspaces`)
    .where('type', '==', 'personal')
    .where('ownerId', '==', uid)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

async function countDryRunStats(db, appId, uid) {
  const base = `artifacts/${appId}/users/${uid}`;
  const counts = {};
  for (const name of [
    'brackets',
    'calendarSessions',
    'playoffConvocatorias',
    'exercises',
    'teams',
    'conversations',
    'proactiveNotifications',
  ]) {
    counts[name] = await countDocsRecursive(db, `${base}/${name}`);
  }
  const totalDocs = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, totalDocs };
}

export async function migrateUser(db, appId, uid, { dryRun = false } = {}) {
  // 1. Idempotency check
  const existing = await findExistingPersonal(db, appId, uid);
  if (existing) {
    return { status: 'skipped', message: `personal workspace already exists: ${existing}`, newWsId: existing };
  }

  // 2. Generate wsId
  const newWsId = db.collection(`artifacts/${appId}/workspaces`).doc().id;

  // 3. Dry-run: count, return
  if (dryRun) {
    const { counts, totalDocs } = await countDryRunStats(db, appId, uid);
    return {
      status: 'migrated',
      newWsId,
      message: `[DRY-RUN] would create wsId=${newWsId}, total ${totalDocs} docs across ${JSON.stringify(counts)}`,
    };
  }

  // 4. Create workspace + member + cache atomically
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db
    .batch()
    .set(db.doc(`artifacts/${appId}/workspaces/${newWsId}`), {
      type: 'personal',
      name: 'Mi cuenta',
      ownerId: uid,
      createdAt: now,
      updatedAt: now,
      plan: 'free',
      planUpdatedAt: null,
      billing: null,
    })
    .set(db.doc(`artifacts/${appId}/workspaces/${newWsId}/members/${uid}`), {
      role: 'owner',
      assignedTeamIds: [],
      joinedAt: now,
    })
    .set(db.doc(`artifacts/${appId}/users/${uid}/memberships/${newWsId}`), {
      role: 'owner',
      workspaceName: 'Mi cuenta',
      workspaceType: 'personal',
      joinedAt: now,
    })
    .commit();

  // 5. Copy subcollections
  const counts = {};
  counts.brackets = await copyCollection(
    db,
    `artifacts/${appId}/users/${uid}/brackets`,
    `artifacts/${appId}/workspaces/${newWsId}/brackets`,
  );
  counts.calendarSessions = await copyCollection(
    db,
    `artifacts/${appId}/users/${uid}/calendarSessions`,
    `artifacts/${appId}/workspaces/${newWsId}/calendarSessions`,
  );
  counts.playoffConvocatorias = await copyCollection(
    db,
    `artifacts/${appId}/users/${uid}/playoffConvocatorias`,
    `artifacts/${appId}/workspaces/${newWsId}/playoffConvocatorias`,
  );
  counts.exercises = await copyCollection(
    db,
    `artifacts/${appId}/users/${uid}/exercises`,
    `artifacts/${appId}/workspaces/${newWsId}/exercises`,
  );
  counts.teams = await copyTeamsRecursive(db, appId, uid, newWsId);

  // 6. Restructure conversations + add wsId to notifs
  counts.conversations = await moveConversationsToPickHistory(db, appId, uid, newWsId);
  counts.notifications = await addWsIdToNotifications(db, appId, uid, newWsId);

  // 7. Verify counts
  const verify = await verifyMigration(db, appId, uid, newWsId);
  if (!verify.ok) {
    return {
      status: 'failed',
      newWsId,
      error: `verify mismatch: ${JSON.stringify(verify.diffs)}`,
    };
  }

  return {
    status: 'migrated',
    newWsId,
    message: `wsId=${newWsId}, counts=${JSON.stringify(counts)}`,
  };
}
