import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInviteMember } from "./inviteMember";

const APP_ID = "app-test"; const WS_ID = "ws-1";

function makeDb(opts: { callerRole?: "dt"|"coach"|null; callerIsOwner?: boolean; existingTeamIds?: string[]; } = {}) {
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  const teamIds = new Set(opts.existingTeamIds ?? ["team-A", "team-B"]);
  const wsDoc = { exists: true, data: () => ({ ownerId: opts.callerIsOwner ? "uid-caller" : "uid-other" }) };
  const memberDoc = opts.callerRole
    ? { exists: true, data: () => ({ role: opts.callerRole }) }
    : { exists: false, data: () => undefined };
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) return wsDoc;
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-caller`) return memberDoc;
        if (path.includes("/teams/")) {
          const id = path.split("/").pop()!;
          return { exists: teamIds.has(id), data: () => undefined };
        }
        return { exists: false, data: () => undefined };
      },
      set: async (data: Record<string, unknown>) => { writes.push({ path, data }); },
    }),
    collection: (path: string) => ({ doc: () => ({ id: "inv-generated", path: `${path}/inv-generated` }) }),
  };
  return { db: db as unknown as Parameters<typeof handleInviteMember>[0]["db"], writes };
}

describe("handleInviteMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DT can create invite, returns inviteId + link", async () => {
    const { db, writes } = makeDb({ callerRole: "dt" });
    const result = await handleInviteMember({
      db, appId: APP_ID, auth: { uid: "uid-caller" }, appBaseUrl: "https://app.com",
      data: { wsId: WS_ID, role: "coach", assignedTeamIds: ["team-A"], email: "p@x.com", name: "Pepe" },
    });
    expect(result.inviteId).toBe("inv-generated");
    expect(result.link).toBe(`https://app.com/invite/${WS_ID}/inv-generated`);
    expect(writes[0].data).toMatchObject({
      role: "coach", assignedTeamIds: ["team-A"], inviteEmail: "p@x.com", inviteName: "Pepe",
      invitedBy: "uid-caller", workspaceId: WS_ID,
    });
  });

  it("coach (non-DT, non-owner) is denied", async () => {
    const { db } = makeDb({ callerRole: "coach" });
    await expect(handleInviteMember({
      db, appId: APP_ID, auth: { uid: "uid-caller" }, appBaseUrl: "https://app.com",
      data: { wsId: WS_ID, role: "coach", assignedTeamIds: ["team-A"] },
    })).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects invalid role", async () => {
    const { db } = makeDb({ callerRole: "dt" });
    await expect(handleInviteMember({
      db, appId: APP_ID, auth: { uid: "uid-caller" }, appBaseUrl: "https://app.com",
      data: { wsId: WS_ID, role: "admin" as never, assignedTeamIds: ["team-A"] },
    })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects nonexistent teamId", async () => {
    const { db } = makeDb({ callerRole: "dt", existingTeamIds: ["team-A"] });
    await expect(handleInviteMember({
      db, appId: APP_ID, auth: { uid: "uid-caller" }, appBaseUrl: "https://app.com",
      data: { wsId: WS_ID, role: "coach", assignedTeamIds: ["team-ghost"] },
    })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects malformed email", async () => {
    const { db } = makeDb({ callerRole: "dt" });
    await expect(handleInviteMember({
      db, appId: APP_ID, auth: { uid: "uid-caller" }, appBaseUrl: "https://app.com",
      data: { wsId: WS_ID, role: "coach", assignedTeamIds: ["team-A"], email: "not-an-email" },
    })).rejects.toMatchObject({ code: "invalid-argument" });
  });
});
