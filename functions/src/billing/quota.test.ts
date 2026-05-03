// functions/src/billing/quota.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { assertWithinQuota } from "./quota";

const APP_ID = "test-app";
const WS_ID = "ws-1";
// Unique per run to avoid cross-run interference; emulator restart clears stale data.
const PROJECT_ID = "quota-test-" + Date.now();

let app: App;
let db: Firestore;

beforeAll(() => {
  // FIRESTORE_EMULATOR_HOST must be set before initializeApp; the Admin SDK reads it at SDK init time.
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  app = initializeApp({ projectId: PROJECT_ID }, "quota-test");
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await fetch(
    `http://localhost:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

async function setupWorkspace(plan: "free" | "pro") {
  await db.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`).set({
    plan,
    ownerId: "uid-1",
    type: "personal",
    name: "Mi cuenta",
  });
}

describe("assertWithinQuota", () => {
  it("free plan: passes when count under FREE_QUOTA", async () => {
    await setupWorkspace("free");
    const result = await assertWithinQuota(db, { wsId: WS_ID, appId: APP_ID });
    expect(result.count).toBe(1);
  });

  it("free plan: throws resource-exhausted when count exceeds FREE_QUOTA", async () => {
    await setupWorkspace("free");
    for (let i = 0; i < 50; i++) {
      await assertWithinQuota(db, { wsId: WS_ID, appId: APP_ID });
    }
    await expect(
      assertWithinQuota(db, { wsId: WS_ID, appId: APP_ID })
    ).rejects.toThrow(HttpsError);
  });

  it("free plan: error has details with count, limit, monthId", async () => {
    await setupWorkspace("free");
    for (let i = 0; i < 50; i++) {
      await assertWithinQuota(db, { wsId: WS_ID, appId: APP_ID });
    }
    try {
      await assertWithinQuota(db, { wsId: WS_ID, appId: APP_ID });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpsError);
      const httpsErr = err as HttpsError;
      expect(httpsErr.code).toBe("resource-exhausted");
      expect(httpsErr.details).toEqual({
        count: 51,
        limit: 50,
        monthId: "2026-05",
      });
    }
  });

  it("pro plan: never throws even past PRO_FAIR_USE", async () => {
    await setupWorkspace("pro");
    // Pre-set the counter to 2000 directly to avoid 2000 sequential calls
    await db
      .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/usage/2026-05`)
      .set({ count: 2000, monthId: "2026-05", lastIncrementAt: new Date() });
    // 2001st call must not throw
    const result = await assertWithinQuota(db, { wsId: WS_ID, appId: APP_ID });
    expect(result.count).toBe(2001);
  });

  it("throws not-found when workspace doc does not exist", async () => {
    // No setupWorkspace call — workspace doesn't exist
    await expect(
      assertWithinQuota(db, { wsId: "missing", appId: APP_ID })
    ).rejects.toThrow(/workspace not found/i);
  });
});
