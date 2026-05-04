import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRevokeMember } from "./revokeMember";

const APP_ID = "app-test"; const WS_ID = "ws-1";

function makeDb(opts: { callerRole?: "dt"|"coach"|null; ownerId?: string }) {
  const ops: Array<{ kind: "delete"; path: string }> = [];
  const tx = {
    get: async (ref: { path: string }) => {
      if (ref.path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) {
        return { exists: true, data: () => ({ ownerId: opts.ownerId ?? "uid-owner" }) };
      }
      if (ref.path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-caller`) {
        return opts.callerRole ? { exists: true, data: () => ({ role: opts.callerRole }) } : { exists: false, data: () => undefined };
      }
      return { exists: false, data: () => undefined };
    },
    delete: (ref: { path: string }) => ops.push({ kind: "delete", path: ref.path }),
  };
  const db = {
    doc: (path: string) => ({ path }),
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return { db: db as unknown as Parameters<typeof handleRevokeMember>[0]["db"], ops };
}

describe("handleRevokeMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DT revokes coach atomically (member + membership)", async () => {
    const { db, ops } = makeDb({ callerRole: "dt", ownerId: "uid-owner" });
    const result = await handleRevokeMember({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, memberUid: "uid-coach" },
    });
    expect(result).toEqual({ ok: true });
    expect(ops).toHaveLength(2);
    expect(ops.map(o => o.path)).toEqual(expect.arrayContaining([
      `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-coach`,
      `artifacts/${APP_ID}/users/uid-coach/memberships/${WS_ID}`,
    ]));
  });

  it("rejects revoking the owner", async () => {
    const { db } = makeDb({ callerRole: "dt", ownerId: "uid-owner" });
    await expect(handleRevokeMember({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, memberUid: "uid-owner" },
    })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("coach (non-DT, non-owner) denied", async () => {
    const { db } = makeDb({ callerRole: "coach", ownerId: "uid-owner" });
    await expect(handleRevokeMember({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, memberUid: "uid-coach" },
    })).rejects.toMatchObject({ code: "permission-denied" });
  });
});
