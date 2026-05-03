// functions/src/billing/usage.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { incrementUsage } from "./usage";

const APP_ID = "test-app";
const WS_ID = "ws-1";
const MONTH_ID = "2026-05";
// Unique per run to avoid cross-run interference; emulator restart clears stale data.
const PROJECT_ID = "billing-test-" + Date.now();

let app: App;
let db: Firestore;

// FIRESTORE_EMULATOR_HOST must be set before initializeApp; the Admin SDK reads it at SDK init time.
beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  app = initializeApp({ projectId: PROJECT_ID }, "billing-test");
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  // Clear all docs in this project's database via emulator REST endpoint
  await fetch(
    `http://localhost:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" }
  );
});

describe("incrementUsage", () => {
  it("creates the doc with count=1 on first call", async () => {
    const result = await incrementUsage(db, APP_ID, WS_ID, MONTH_ID);
    expect(result).toEqual({ count: 1, monthId: MONTH_ID });

    const snap = await db
      .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/usage/${MONTH_ID}`)
      .get();
    expect(snap.data()?.count).toBe(1);
    expect(snap.data()?.monthId).toBe(MONTH_ID);
  });

  it("increments existing doc atomically", async () => {
    await incrementUsage(db, APP_ID, WS_ID, MONTH_ID);
    await incrementUsage(db, APP_ID, WS_ID, MONTH_ID);
    const result = await incrementUsage(db, APP_ID, WS_ID, MONTH_ID);
    expect(result.count).toBe(3);
  });

  it("uses different docs for different months", async () => {
    await incrementUsage(db, APP_ID, WS_ID, "2026-04");
    const result = await incrementUsage(db, APP_ID, WS_ID, "2026-05");
    expect(result.count).toBe(1);

    const aprilSnap = await db
      .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/usage/2026-04`)
      .get();
    expect(aprilSnap.data()?.count).toBe(1);
  });
});
