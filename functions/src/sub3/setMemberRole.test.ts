import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSetMemberRole } from "./setMemberRole";

const APP_ID = "app-test"; const WS_ID = "ws-1";

function makeDb(opts: { callerRole?: "dt"|"coach"|null; ownerId?: string }) {
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) {
          return { exists: true, data: () => ({ ownerId: opts.ownerId ?? "uid-owner" }) };
        }
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-caller`) {
          return opts.callerRole ? { exists: true, data: () => ({ role: opts.callerRole }) } : { exists: false, data: () => undefined };
        }
        return { exists: false, data: () => undefined };
      },
      update: async (data: Record<string, unknown>) => { updates.push({ path, data }); },
    }),
  };
  return { db: db as unknown as Parameters<typeof handleSetMemberRole>[0]["db"], updates };
}

describe("handleSetMemberRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("promotes coach to DT", async () => {
    const { db, updates } = makeDb({ callerRole: "dt" });
    await handleSetMemberRole({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, memberUid: "uid-coach", role: "dt" },
    });
    expect(updates[0]).toMatchObject({
      path: `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-coach`,
      data: { role: "dt" },
    });
  });

  it("rejects invalid role", async () => {
    const { db } = makeDb({ callerRole: "dt" });
    await expect(handleSetMemberRole({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, memberUid: "uid-coach", role: "admin" as never },
    })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects targeting the owner", async () => {
    const { db } = makeDb({ callerRole: "dt" });
    await expect(handleSetMemberRole({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, memberUid: "uid-owner", role: "coach" },
    })).rejects.toMatchObject({ code: "failed-precondition" });
  });
});
