// functions/src/migrations/migrateToSubproyecto2.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { handleMigration } from "./migrateToSubproyecto2";

const SUPERADMIN_UID = "y6vqlMynjRQeRpAKUnYmQdUiMen1";

interface MockDoc {
  id: string;
  ref: { update: ReturnType<typeof vi.fn> };
  data: () => Record<string, unknown>;
}

function makeDoc(id: string, data: Record<string, unknown>, update = vi.fn().mockResolvedValue(undefined)): MockDoc {
  return { id, ref: { update }, data: () => data };
}

function makeDb(plan: Record<string, MockDoc[]>) {
  return {
    collection: (path: string) => ({
      get: () => Promise.resolve({ docs: plan[path] ?? [] }),
    }),
  } as unknown as import("firebase-admin").firestore.Firestore;
}

describe("handleMigration (sub-2 backfill)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza si uid no es super-admin", async () => {
    const db = makeDb({});
    let err: unknown;
    try {
      await handleMigration({ db, uid: "intruder" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(HttpsError);
    expect((err as HttpsError).code).toBe("permission-denied");
  });

  it("backfilea membership sin role/assignedTeamIds; idempotente sobre re-run", async () => {
    const APP = "artifacts/uros-fbm-app";
    const wsId = "ws1";

    const memberUpdate = vi.fn().mockResolvedValue(undefined);
    const memberLegacy = makeDoc("owner-uid", {}, memberUpdate);

    const team1 = makeDoc("t1", {});

    const db = makeDb({
      [`${APP}/workspaces`]: [makeDoc(wsId, { ownerId: "owner-uid" })],
      [`${APP}/workspaces/${wsId}/teams`]: [team1],
      [`${APP}/workspaces/${wsId}/members`]: [memberLegacy],
      [`${APP}/workspaces/${wsId}/exercises`]: [],
      [`${APP}/workspaces/${wsId}/brackets`]: [],
      [`${APP}/workspaces/${wsId}/calendarSessions`]: [],
      [`${APP}/workspaces/${wsId}/teams/t1/trainings`]: [],
      [`${APP}/workspaces/${wsId}/teams/t1/members`]: [],
    });

    const result = await handleMigration({ db, uid: SUPERADMIN_UID });

    expect(memberUpdate).toHaveBeenCalledWith({
      role: "dt",
      assignedTeamIds: ["t1"],
    });
    expect(result.workspacesProcessed).toBe(1);
    expect(result.membershipsBackfilled).toBe(1);
    expect(result.docsBackfilled).toBe(0);
  });

  it("no toca membership con role + assignedTeamIds ya presentes", async () => {
    const APP = "artifacts/uros-fbm-app";
    const wsId = "ws1";

    const memberUpdate = vi.fn().mockResolvedValue(undefined);
    const memberMigrated = makeDoc(
      "owner-uid",
      { role: "dt", assignedTeamIds: ["t1"] },
      memberUpdate,
    );

    const db = makeDb({
      [`${APP}/workspaces`]: [makeDoc(wsId, { ownerId: "owner-uid" })],
      [`${APP}/workspaces/${wsId}/teams`]: [],
      [`${APP}/workspaces/${wsId}/members`]: [memberMigrated],
      [`${APP}/workspaces/${wsId}/exercises`]: [],
      [`${APP}/workspaces/${wsId}/brackets`]: [],
      [`${APP}/workspaces/${wsId}/calendarSessions`]: [],
    });

    const result = await handleMigration({ db, uid: SUPERADMIN_UID });

    expect(memberUpdate).not.toHaveBeenCalled();
    expect(result.membershipsBackfilled).toBe(0);
  });

  it("backfilea createdBy en exercises huérfanos con el ownerId del workspace", async () => {
    const APP = "artifacts/uros-fbm-app";
    const wsId = "ws1";

    const exerciseUpdate = vi.fn().mockResolvedValue(undefined);
    const exerciseLegacy = makeDoc("ex1", {}, exerciseUpdate);
    const exerciseMigrated = makeDoc("ex2", { createdBy: "someone-else" });

    const db = makeDb({
      [`${APP}/workspaces`]: [makeDoc(wsId, { ownerId: "owner-uid" })],
      [`${APP}/workspaces/${wsId}/teams`]: [],
      [`${APP}/workspaces/${wsId}/members`]: [],
      [`${APP}/workspaces/${wsId}/exercises`]: [exerciseLegacy, exerciseMigrated],
      [`${APP}/workspaces/${wsId}/brackets`]: [],
      [`${APP}/workspaces/${wsId}/calendarSessions`]: [],
    });

    const result = await handleMigration({ db, uid: SUPERADMIN_UID });

    expect(exerciseUpdate).toHaveBeenCalledWith({ createdBy: "owner-uid" });
    expect(result.docsBackfilled).toBe(1);
  });

  it("salta workspaces sin ownerId con warning", async () => {
    const APP = "artifacts/uros-fbm-app";
    const wsId = "broken";

    const db = makeDb({
      [`${APP}/workspaces`]: [makeDoc(wsId, {})],
    });

    const result = await handleMigration({ db, uid: SUPERADMIN_UID });

    expect(result.workspacesProcessed).toBe(0);
    expect(result.membershipsBackfilled).toBe(0);
    expect(result.docsBackfilled).toBe(0);
  });
});
