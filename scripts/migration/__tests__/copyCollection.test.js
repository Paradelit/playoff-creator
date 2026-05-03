// Tests run against the Firestore Emulator using firebase-admin (not the
// client SDK exposed by @firebase/rules-unit-testing) because copyCollection
// relies on Admin-only `ref.listCollections()`. The emulator picks up the
// FIRESTORE_EMULATOR_HOST env var and skips credential checks.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
// Suppress firebase-admin's metadata-server lookup attempt (only relevant in GCP).
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'pickncoach-mig-test';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import admin from 'firebase-admin';
import { copyCollection } from '../lib/copyCollection.js';

// Each test file uses its own project id so parallel runs do not share data.
const PROJECT_ID = 'pickncoach-mig-test-copycollection';
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
  app = admin.initializeApp({ projectId: PROJECT_ID }, `mig-test-copyCollection-${Date.now()}`);
  db = app.firestore();
});

afterAll(async () => {
  await app.delete();
});

beforeEach(async () => {
  await clearFirestore();
});

describe('copyCollection', () => {
  it('copies all documents from src to dest with same ids', async () => {
    await db.doc('src/a').set({ name: 'A' });
    await db.doc('src/b').set({ name: 'B' });

    const copied = await copyCollection(db, 'src', 'dest');

    expect(copied).toBe(2);
    const destA = await db.doc('dest/a').get();
    expect(destA.data().name).toBe('A');
  });

  it('copies subcollections recursively', async () => {
    await db.doc('src/a').set({ name: 'A' });
    await db.doc('src/a/sub/x').set({ value: 1 });
    await db.doc('src/a/sub/y').set({ value: 2 });

    const copied = await copyCollection(db, 'src', 'dest');

    expect(copied).toBe(3); // 1 root + 2 in sub
    const subX = await db.doc('dest/a/sub/x').get();
    expect(subX.data().value).toBe(1);
  });

  it('is idempotent on re-run', async () => {
    await db.doc('src/a').set({ name: 'A' });
    await copyCollection(db, 'src', 'dest');
    const firstSnap = await db.doc('dest/a').get();
    expect(firstSnap.exists).toBe(true);

    await copyCollection(db, 'src', 'dest');
    const secondSnap = await db.doc('dest/a').get();

    expect(secondSnap.data().name).toBe('A');
    // updateTime may or may not advance with merge=true; the important thing is no duplicate or error
    const allDocs = await db.collection('dest').get();
    expect(allDocs.size).toBe(1);
  });

  it('returns 0 when src has no docs', async () => {
    const copied = await copyCollection(db, 'src', 'dest');
    expect(copied).toBe(0);
  });
});
