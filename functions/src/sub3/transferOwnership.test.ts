import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleTransferOwnership } from "./transferOwnership";

const APP_ID = "app-test"; const WS_ID = "ws-1";

function makeDb(opts: { ownerId?: string; newOwnerExistsAsMember?: boolean }) {
  const ops: Array<{ kind: "update"; path: string; data: Record<string, unknown> }> = [];
  const tx = {
    get: async (ref: { path: string }) => {
      if (ref.path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) {
        return { exists: true, data: () => ({ ownerId: opts.ownerId ?? "uid-owner" }) };
      }
      if (ref.path.includes("/members/uid-newOwner")) {
        return opts.newOwnerExistsAsMember ? { exists: true, data: () => ({ role: "coach" }) } : { exists: false, data: () => undefined };
      }
      return { exists: false, data: () => undefined };
    },
    update: (ref: { path: string }, data: Record<string, unknown>) => ops.push({ kind: "update", path: ref.path, data }),
  };
  const db = {
    doc: (path: string) => ({ path }),
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return { db: db as unknown as Parameters<typeof handleTransferOwnership>[0]["db"], ops };
}

describe("handleTransferOwnership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("owner transfers + new owner role bumped to dt", async () => {
    const { db, ops } = makeDb({ ownerId: "uid-owner", newOwnerExistsAsMember: true });
    const r = await handleTransferOwnership({
      db, appId: APP_ID, auth: { uid: "uid-owner" },
      data: { wsId: WS_ID, newOwnerUid: "uid-newOwner" },
    });
    expect(r).toEqual({ ok: true });
    expect(ops.find(o => o.path === `artifacts/${APP_ID}/workspaces/${WS_ID}` && o.data.ownerId === "uid-newOwner")).toBeTruthy();
    expect(ops.find(o => o.path.endsWith("/members/uid-newOwner") && o.data.role === "dt")).toBeTruthy();
  });

  it("non-owner denied", async () => {
    const { db } = makeDb({ ownerId: "uid-other", newOwnerExistsAsMember: true });
    await expect(handleTransferOwnership({
      db, appId: APP_ID, auth: { uid: "uid-owner" },
      data: { wsId: WS_ID, newOwnerUid: "uid-newOwner" },
    })).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects newOwner === caller (no-op transfer)", async () => {
    const { db } = makeDb({ ownerId: "uid-owner", newOwnerExistsAsMember: true });
    await expect(handleTransferOwnership({
      db, appId: APP_ID, auth: { uid: "uid-owner" },
      data: { wsId: WS_ID, newOwnerUid: "uid-owner" },
    })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects newOwner not member of workspace", async () => {
    const { db } = makeDb({ ownerId: "uid-owner", newOwnerExistsAsMember: false });
    await expect(handleTransferOwnership({
      db, appId: APP_ID, auth: { uid: "uid-owner" },
      data: { wsId: WS_ID, newOwnerUid: "uid-newOwner" },
    })).rejects.toMatchObject({ code: "failed-precondition" });
  });
});
