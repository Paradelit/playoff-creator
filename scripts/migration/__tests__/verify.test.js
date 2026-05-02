// See copyCollection.test.js for the Admin-SDK + emulator setup rationale.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'pickncoach-mig-test';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import admin from 'firebase-admin';
import { verifyMigration, countDocsRecursive } from '../lib/verify.js';

// Each test file uses its own project id so parallel runs do not share data.
const PROJECT_ID = 'pickncoach-mig-test-verify';
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
  app = admin.initializeApp({ projectId: PROJECT_ID }, `mig-test-verify-${Date.now()}`);
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
const WS_ID = 'ws1';

describe('countDocsRecursive', () => {
  it('counts all docs including subcollections', async () => {
    await db.doc(`a/x`).set({});
    await db.doc(`a/x/sub/y`).set({});
    await db.doc(`a/z`).set({});
    expect(await countDocsRecursive(db, 'a')).toBe(3);
  });

  it('returns 0 for empty path', async () => {
    expect(await countDocsRecursive(db, 'empty')).toBe(0);
  });
});

describe('verifyMigration', () => {
  async function seedSourceWith(counts) {
    const base = `artifacts/${APP_ID}/users/${UID}`;
    for (let i = 0; i < counts.brackets; i++) await db.doc(`${base}/brackets/b${i}`).set({});
    for (let i = 0; i < counts.calendarSessions; i++) await db.doc(`${base}/calendarSessions/c${i}`).set({});
    for (let i = 0; i < counts.exercises; i++) await db.doc(`${base}/exercises/e${i}`).set({});
    for (let i = 0; i < counts.playoffConvocatorias; i++) await db.doc(`${base}/playoffConvocatorias/p${i}`).set({});
  }

  async function seedDestMatching(counts) {
    const base = `artifacts/${APP_ID}/workspaces/${WS_ID}`;
    for (let i = 0; i < counts.brackets; i++) await db.doc(`${base}/brackets/b${i}`).set({});
    for (let i = 0; i < counts.calendarSessions; i++) await db.doc(`${base}/calendarSessions/c${i}`).set({});
    for (let i = 0; i < counts.exercises; i++) await db.doc(`${base}/exercises/e${i}`).set({});
    for (let i = 0; i < counts.playoffConvocatorias; i++) await db.doc(`${base}/playoffConvocatorias/p${i}`).set({});
  }

  it('returns ok=true when all counts match', async () => {
    const c = { brackets: 2, calendarSessions: 3, exercises: 1, playoffConvocatorias: 0 };
    await seedSourceWith(c);
    await seedDestMatching(c);
    const result = await verifyMigration(db, APP_ID, UID, WS_ID);
    expect(result.ok).toBe(true);
    expect(result.diffs).toEqual([]);
  });

  it('returns diffs when counts mismatch', async () => {
    await seedSourceWith({ brackets: 5, calendarSessions: 0, exercises: 0, playoffConvocatorias: 0 });
    await seedDestMatching({ brackets: 3, calendarSessions: 0, exercises: 0, playoffConvocatorias: 0 });
    const result = await verifyMigration(db, APP_ID, UID, WS_ID);
    expect(result.ok).toBe(false);
    expect(result.diffs).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'brackets', oldCount: 5, newCount: 3 })]),
    );
  });

  it('returns ok=true when conversations were copied to pickHistory and all notifs have wsId', async () => {
    const oldBase = `artifacts/${APP_ID}/users/${UID}`;
    // Seed conversations in the old location AND a matching pickHistory copy.
    await db.doc(`${oldBase}/conversations/c1`).set({});
    await db.doc(`${oldBase}/conversations/c2`).set({});
    await db.doc(`${oldBase}/pickHistory/${WS_ID}/conversations/c1`).set({});
    await db.doc(`${oldBase}/pickHistory/${WS_ID}/conversations/c2`).set({});
    // Notifs all tagged with wsId.
    await db.doc(`${oldBase}/proactiveNotifications/n1`).set({ wsId: WS_ID });
    await db.doc(`${oldBase}/proactiveNotifications/n2`).set({ wsId: WS_ID });

    const result = await verifyMigration(db, APP_ID, UID, WS_ID);
    expect(result.ok).toBe(true);
    expect(result.diffs).toEqual([]);
  });

  it('flags a conversations parity mismatch between users/{uid}/conversations and pickHistory', async () => {
    const oldBase = `artifacts/${APP_ID}/users/${UID}`;
    await db.doc(`${oldBase}/conversations/c1`).set({});
    await db.doc(`${oldBase}/conversations/c2`).set({});
    await db.doc(`${oldBase}/pickHistory/${WS_ID}/conversations/c1`).set({});
    // c2 is missing in pickHistory.

    const result = await verifyMigration(db, APP_ID, UID, WS_ID);
    expect(result.ok).toBe(false);
    expect(result.diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'conversations (pickHistory)', oldCount: 2, newCount: 1 }),
      ]),
    );
  });

  it('flags notifications missing the wsId field', async () => {
    const oldBase = `artifacts/${APP_ID}/users/${UID}`;
    await db.doc(`${oldBase}/proactiveNotifications/n1`).set({ wsId: WS_ID });
    await db.doc(`${oldBase}/proactiveNotifications/n2`).set({ message: 'no wsId' });
    await db.doc(`${oldBase}/proactiveNotifications/n3`).set({ message: 'also no wsId' });

    const result = await verifyMigration(db, APP_ID, UID, WS_ID);
    expect(result.ok).toBe(false);
    expect(result.diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'notifications without wsId', oldCount: 2, newCount: 0 }),
      ]),
    );
  });
});
