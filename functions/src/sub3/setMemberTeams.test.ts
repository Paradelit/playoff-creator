import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSetMemberTeams } from "./setMemberTeams";

const APP_ID = "app-test"; const WS_ID = "ws-1";

function makeDb(opts: { callerRole?: "dt"|"coach"|null; callerIsOwner?: boolean; existingTeamIds?: string[]; ownerId?: string }) {
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const teamIds = new Set(opts.existingTeamIds ?? ["team-A", "team-B"]);
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) {
          return { exists: true, data: () => ({ ownerId: opts.ownerId ?? (opts.callerIsOwner ? "uid-caller" : "uid-other") }) };
        }
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-caller`) {
          return opts.callerRole ? { exists: true, data: () => ({ role: opts.callerRole }) } : { exists: false, data: () => undefined };
        }
        if (path.includes("/teams/")) {
          const id = path.split("/").pop()!;
          return { exists: teamIds.has(id), data: () => undefined };
        }
        return { exists: false, data: () => undefined };
      },
      update: async (data: Record<string, unknown>) => { updates.push({ path, data }); },
    }),
  };
  return { db: db as unknown as Parameters<typeof handleSetMemberTeams>[0]["db"], updates };
}

describe("handleSetMemberTeams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DT updates a coach's teams", async () => {
    const { db, updates } = makeDb({ callerRole: "dt", ownerId: "uid-owner" });
    const r = await handleSetMemberTeams({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, memberUid: "uid-coach", assignedTeamIds: ["team-A", "team-B"] },
    });
    expect(r).toEqual({ ok: true });
    expect(updates[0]).toMatchObject({
      path: `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-coach`,
      data: { assignedTeamIds: ["team-A", "team-B"] },
    });
  });

  it("rejects invalid teamId", async () => {
    const { db } = makeDb({ callerRole: "dt", existingTeamIds: ["team-A"], ownerId: "uid-owner" });
    await expect(handleSetMemberTeams({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, memberUid: "uid-coach", assignedTeamIds: ["team-ghost"] },
    })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("DT non-owner cannot edit owner's assignment", async () => {
    const { db } = makeDb({ callerRole: "dt", ownerId: "uid-owner" });
    await expect(handleSetMemberTeams({
      db, appId: APP_ID, auth: { uid: "uid-caller" },
      data: { wsId: WS_ID, memberUid: "uid-owner", assignedTeamIds: ["team-A"] },
    })).rejects.toMatchObject({ code: "permission-denied" });
  });
});
