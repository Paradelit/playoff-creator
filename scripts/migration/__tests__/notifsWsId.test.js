// See copyCollection.test.js for the Admin-SDK + emulator setup rationale.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'pickncoach-mig-test';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import admin from 'firebase-admin';
import { addWsIdToNotifications } from '../lib/notifsWsId.js';

// Each test file uses its own project id so parallel runs do not share data.
const PROJECT_ID = 'pickncoach-mig-test-notifs';
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
  app = admin.initializeApp({ projectId: PROJECT_ID }, `mig-test-notifsWsId-${Date.now()}`);
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
const PATH = `artifacts/${APP_ID}/users/${UID}/proactiveNotifications`;

describe('addWsIdToNotifications', () => {
  it('adds wsId to docs that lack it', async () => {
    await db.doc(`${PATH}/n1`).set({ message: 'A' });
    await db.doc(`${PATH}/n2`).set({ message: 'B' });

    const updated = await addWsIdToNotifications(db, APP_ID, UID, WS_ID);

    expect(updated).toBe(2);
    const n1 = await db.doc(`${PATH}/n1`).get();
    expect(n1.data().wsId).toBe(WS_ID);
  });

  it('skips docs that already have wsId (idempotent)', async () => {
    await db.doc(`${PATH}/n1`).set({ message: 'A', wsId: 'preexisting' });
    await db.doc(`${PATH}/n2`).set({ message: 'B' });

    const updated = await addWsIdToNotifications(db, APP_ID, UID, WS_ID);

    expect(updated).toBe(1);
    const n1 = await db.doc(`${PATH}/n1`).get();
    expect(n1.data().wsId).toBe('preexisting');
  });

  it('returns 0 when there are no notifs', async () => {
    expect(await addWsIdToNotifications(db, APP_ID, UID, WS_ID)).toBe(0);
  });
});
