import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRevokeInvite } from "./revokeInvite";

const APP_ID = "app-test"; const WS_ID = "ws-1"; const INVITE_ID = "inv-1";

function makeDb(callerRole: "dt"|"coach"|null) {
  const deletes: string[] = [];
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) return { exists: true, data: () => ({ ownerId: "uid-other" }) };
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-caller`) {
          return callerRole ? { exists: true, data: () => ({ role: callerRole }) } : { exists: false, data: () => undefined };
        }
        return { exists: false, data: () => undefined };
      },
      delete: async () => { deletes.push(path); },
    }),
  };
  return { db: db as unknown as Parameters<typeof handleRevokeInvite>[0]["db"], deletes };
}

describe("handleRevokeInvite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DT can revoke", async () => {
    const { db, deletes } = makeDb("dt");
    const result = await handleRevokeInvite({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    });
    expect(result).toEqual({ ok: true });
    expect(deletes).toContain(`artifacts/${APP_ID}/workspaces/${WS_ID}/invites/${INVITE_ID}`);
  });

  it("coach denied", async () => {
    const { db } = makeDb("coach");
    await expect(handleRevokeInvite({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    })).rejects.toMatchObject({ code: "permission-denied" });
  });
});
