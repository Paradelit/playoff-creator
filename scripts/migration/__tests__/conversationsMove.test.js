// See copyCollection.test.js for the Admin-SDK + emulator setup rationale.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'pickncoach-mig-test';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import admin from 'firebase-admin';
import { moveConversationsToPickHistory } from '../lib/conversationsMove.js';

// Each test file uses its own project id so parallel runs do not share data.
const PROJECT_ID = 'pickncoach-mig-test-conversations';
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
  app = admin.initializeApp({ projectId: PROJECT_ID }, `mig-test-conversationsMove-${Date.now()}`);
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
const OLD = `artifacts/${APP_ID}/users/${UID}/conversations`;
const NEW = `artifacts/${APP_ID}/users/${UID}/pickHistory/${WS_ID}/conversations`;

describe('moveConversationsToPickHistory', () => {
  it('copies conversations and their messages subcollection', async () => {
    await db.doc(`${OLD}/c1`).set({ titulo: 'Hola' });
    await db.doc(`${OLD}/c1/messages/m1`).set({ texto: 'mensaje' });

    const total = await moveConversationsToPickHistory(db, APP_ID, UID, WS_ID);

    expect(total).toBeGreaterThanOrEqual(2);
    const conv = await db.doc(`${NEW}/c1`).get();
    expect(conv.data().titulo).toBe('Hola');
    const msg = await db.doc(`${NEW}/c1/messages/m1`).get();
    expect(msg.data().texto).toBe('mensaje');
  });

  it('returns 0 when there are no conversations', async () => {
    const total = await moveConversationsToPickHistory(db, APP_ID, UID, WS_ID);
    expect(total).toBe(0);
  });
});
