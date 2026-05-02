import admin from 'firebase-admin';
import { copyCollection } from './copyCollection.js';
import { copyTeamsRecursive } from './copyTeams.js';
import { moveConversationsToPickHistory } from './conversationsMove.js';
import { addWsIdToNotifications } from './notifsWsId.js';
import { verifyMigration, countDocsRecursive } from './verify.js';

/**
 * Returns the wsId of a personal workspace for `uid` ONLY if the workspace was
 * fully migrated (i.e. has `migrationCompleteAt` set). A personal workspace
 * without that field is treated as in-progress and the migration should retry.
 */
async function findCompletedPersonal(db, appId, uid) {
  const snap = await db
    .collection(`artifacts/${appId}/workspaces`)
    .where('type', '==', 'personal')
    .where('ownerId', '==', uid)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return doc.data().migrationCompleteAt ? doc.id : null;
}

/**
 * Returns the wsId of any personal workspace for `uid`, completed or not.
 * Used to reuse an in-progress wsId on retry instead of leaving a duplicate.
 */
async function findAnyPersonal(db, appId, uid) {
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
  // 1. Idempotency check — only skip if a previous run completed.
  const completedWsId = await findCompletedPersonal(db, appId, uid);
  if (completedWsId) {
    return {
      status: 'skipped',
      message: `personal workspace already migrated: ${completedWsId}`,
      newWsId: completedWsId,
    };
  }

  // 2. Reuse any existing in-progress wsId, or generate a new one.
  // (Skip lookup in dry-run since we don't write anything.)
  let existingWsId = null;
  if (!dryRun) {
    existingWsId = await findAnyPersonal(db, appId, uid);
    if (existingWsId) {
      console.log(`[${uid}] retrying incomplete migration: ${existingWsId}`);
    }
  }
  const newWsId = existingWsId ?? db.collection(`artifacts/${appId}/workspaces`).doc().id;

  // 3. Dry-run: count, return.
  if (dryRun) {
    const { counts, totalDocs } = await countDryRunStats(db, appId, uid);
    return {
      status: 'migrated',
      newWsId,
      message: `[DRY-RUN] would create wsId=${newWsId}, total ${totalDocs} docs across ${JSON.stringify(counts)}`,
    };
  }

  // 4. Create workspace + member + cache atomically — only if not retrying.
  if (!existingWsId) {
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
  }

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

  // 8. Mark migration complete (only after verify passes).
  await db.doc(`artifacts/${appId}/workspaces/${newWsId}`).update({
    migrationCompleteAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    status: 'migrated',
    newWsId,
    message: `wsId=${newWsId}, counts=${JSON.stringify(counts)}`,
  };
}
