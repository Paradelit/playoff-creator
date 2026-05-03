// See copyCollection.test.js for the Admin-SDK + emulator setup rationale.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'pickncoach-mig-test';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import admin from 'firebase-admin';
import { copyTeamsRecursive } from '../lib/copyTeams.js';

// Each test file uses its own project id so parallel runs do not share data.
const PROJECT_ID = 'pickncoach-mig-test-copyteams';
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
  app = admin.initializeApp({ projectId: PROJECT_ID }, `mig-test-copyTeams-${Date.now()}`);
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

const SOURCE = `artifacts/${APP_ID}/users/${UID}/teams`;
const DEST = `artifacts/${APP_ID}/workspaces/${WS_ID}/teams`;

describe('copyTeamsRecursive', () => {
  it('copies team docs and known subcollections', async () => {
    await db.doc(`${SOURCE}/t1`).set({ name: 'Senior A' });
    await db.doc(`${SOURCE}/t1/members/m1`).set({ nombre: 'Pepe' });
    await db.doc(`${SOURCE}/t1/trainings/tr1`).set({ titulo: 'Sesión 1' });
    await db.doc(`${SOURCE}/t1/competitions/c1`).set({ nombre: 'Liga' });
    await db.doc(`${SOURCE}/t1/cuaderno/jugadores`).set({ rows: [] });

    const total = await copyTeamsRecursive(db, APP_ID, UID, WS_ID);

    expect(total).toBeGreaterThanOrEqual(5);
    const teamSnap = await db.doc(`${DEST}/t1`).get();
    expect(teamSnap.data().name).toBe('Senior A');
    const memberSnap = await db.doc(`${DEST}/t1/members/m1`).get();
    expect(memberSnap.data().nombre).toBe('Pepe');
    const cuadSnap = await db.doc(`${DEST}/t1/cuaderno/jugadores`).get();
    expect(cuadSnap.exists).toBe(true);
  });

  it('copies all teams when there are several', async () => {
    await db.doc(`${SOURCE}/t1`).set({ name: 'A' });
    await db.doc(`${SOURCE}/t2`).set({ name: 'B' });
    await db.doc(`${SOURCE}/t3`).set({ name: 'C' });

    const total = await copyTeamsRecursive(db, APP_ID, UID, WS_ID);

    expect(total).toBe(3);
    const all = await db.collection(DEST).get();
    expect(all.size).toBe(3);
  });

  it('returns 0 when the user has no teams', async () => {
    const total = await copyTeamsRecursive(db, APP_ID, UID, WS_ID);
    expect(total).toBe(0);
  });
});
