// See copyCollection.test.js for the Admin-SDK + emulator setup rationale.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'pickncoach-mig-test';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import admin from 'firebase-admin';
import { migrateUser } from '../lib/migrateUser.js';

// Each test file uses its own project id so parallel runs do not share data.
const PROJECT_ID = 'pickncoach-mig-test-migrateuser';
let app;
let db;

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const url = `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Failed to clear emulator data: ${res.status} ${await res.text()}`);
  }
}

beforeAll(async () => {
  app = admin.initializeApp({ projectId: PROJECT_ID }, `mig-test-migrateUser-${Date.now()}`);
  db = app.firestore();
});

afterAll(async () => {
  await app.delete();
});

beforeEach(async () => {
  await clearFirestore();
});

const APP_ID = 'app1';
const UID = 'u1';

describe('migrateUser', () => {
  it('creates workspace, member, and membership cache', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });

    expect(result.status).toBe('migrated');
    const wsId = result.newWsId;
    const wsDoc = await db.doc(`artifacts/${APP_ID}/workspaces/${wsId}`).get();
    expect(wsDoc.data().type).toBe('personal');
    expect(wsDoc.data().ownerId).toBe(UID);
    expect(wsDoc.data().plan).toBe('free');

    const memberDoc = await db.doc(`artifacts/${APP_ID}/workspaces/${wsId}/members/${UID}`).get();
    expect(memberDoc.data().role).toBe('owner');

    const cacheDoc = await db.doc(`artifacts/${APP_ID}/users/${UID}/memberships/${wsId}`).get();
    expect(cacheDoc.data().workspaceType).toBe('personal');
  });

  it('copies subcollections', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });
    await db.doc(`artifacts/${APP_ID}/users/${UID}/brackets/b1`).set({ name: 'BR' });
    await db.doc(`artifacts/${APP_ID}/users/${UID}/exercises/e1`).set({ name: 'EX' });
    await db.doc(`artifacts/${APP_ID}/users/${UID}/calendarSessions/c1`).set({ tipo: 'partido' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });

    const ws = result.newWsId;
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/teams/t1`).get()).exists).toBe(true);
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/brackets/b1`).get()).exists).toBe(true);
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/exercises/e1`).get()).exists).toBe(true);
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/calendarSessions/c1`).get()).exists).toBe(true);
  });

  it('is idempotent: re-run returns skipped without creating duplicates', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });
    const first = await migrateUser(db, APP_ID, UID, { dryRun: false });

    const second = await migrateUser(db, APP_ID, UID, { dryRun: false });
    expect(second.status).toBe('skipped');

    const allWorkspaces = await db.collection(`artifacts/${APP_ID}/workspaces`).get();
    expect(allWorkspaces.size).toBe(1);
    expect(allWorkspaces.docs[0].id).toBe(first.newWsId);
  });

  it('sets migrationCompleteAt only after a successful migration', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });
    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });
    expect(result.status).toBe('migrated');
    const wsDoc = await db.doc(`artifacts/${APP_ID}/workspaces/${result.newWsId}`).get();
    expect(wsDoc.data().migrationCompleteAt).toBeTruthy();
  });

  it('retries an incomplete migration: workspace exists without migrationCompleteAt → re-runs and sets the field', async () => {
    // Seed an in-progress workspace (no migrationCompleteAt) for this user, mimicking
    // a migration that committed the workspace + member docs but failed at verify time.
    const orphanWsId = 'orphan-ws-1';
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db
      .batch()
      .set(db.doc(`artifacts/${APP_ID}/workspaces/${orphanWsId}`), {
        type: 'personal',
        name: 'Mi cuenta',
        ownerId: UID,
        createdAt: now,
        updatedAt: now,
        plan: 'free',
        planUpdatedAt: null,
        billing: null,
        // NOTE: no migrationCompleteAt → considered in-progress
      })
      .set(db.doc(`artifacts/${APP_ID}/workspaces/${orphanWsId}/members/${UID}`), {
        role: 'owner',
        assignedTeamIds: [],
        joinedAt: now,
      })
      .set(db.doc(`artifacts/${APP_ID}/users/${UID}/memberships/${orphanWsId}`), {
        role: 'owner',
        workspaceName: 'Mi cuenta',
        workspaceType: 'personal',
        joinedAt: now,
      })
      .commit();

    // Subcollections are missing — the previous attempt failed before copying.
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });
    await db.doc(`artifacts/${APP_ID}/users/${UID}/brackets/b1`).set({ name: 'BR' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });
    expect(result.status).toBe('migrated');
    // Reuses the orphan wsId rather than generating a new one.
    expect(result.newWsId).toBe(orphanWsId);

    // Subcollections were copied on the retry.
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${orphanWsId}/teams/t1`).get()).exists).toBe(true);
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${orphanWsId}/brackets/b1`).get()).exists).toBe(true);

    // migrationCompleteAt is now set.
    const wsDoc = await db.doc(`artifacts/${APP_ID}/workspaces/${orphanWsId}`).get();
    expect(wsDoc.data().migrationCompleteAt).toBeTruthy();

    // No duplicate workspaces.
    const all = await db.collection(`artifacts/${APP_ID}/workspaces`).get();
    expect(all.size).toBe(1);
  });

  it('skips a fully migrated user (workspace has migrationCompleteAt)', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });
    const first = await migrateUser(db, APP_ID, UID, { dryRun: false });
    expect(first.status).toBe('migrated');

    const second = await migrateUser(db, APP_ID, UID, { dryRun: false });
    expect(second.status).toBe('skipped');
    expect(second.newWsId).toBe(first.newWsId);
  });

  it('dry-run does not write anything', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: true });

    expect(result.status).toBe('migrated');
    expect(result.message).toMatch(/DRY-RUN/);
    const wsCount = (await db.collection(`artifacts/${APP_ID}/workspaces`).get()).size;
    expect(wsCount).toBe(0);
  });

  it('migrates a user with no data (just creates workspace + member + cache)', async () => {
    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });
    expect(result.status).toBe('migrated');
    const ws = result.newWsId;
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/members/${UID}`).get()).exists).toBe(true);
  });

  it('renames conversations to pickHistory/{wsId}/conversations', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/conversations/c1`).set({ titulo: 'X' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });
    const ws = result.newWsId;
    const newConv = await db.doc(`artifacts/${APP_ID}/users/${UID}/pickHistory/${ws}/conversations/c1`).get();
    expect(newConv.exists).toBe(true);
  });

  it('adds wsId to existing proactiveNotifications', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/proactiveNotifications/n1`).set({ message: 'X' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });
    const ws = result.newWsId;
    const notif = await db.doc(`artifacts/${APP_ID}/users/${UID}/proactiveNotifications/n1`).get();
    expect(notif.data().wsId).toBe(ws);
  });
});
