import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncOnTeamCreate } from "./onTeamCreate";

const APP_ID = "app-test"; const WS_ID = "ws-1"; const TEAM_ID = "team-new";

function makeDb(opts: { wsType: "personal" | "club"; ownerUid?: string }) {
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const docs: Record<string, { exists: boolean; data: () => Record<string, unknown> }> = {
    [`artifacts/${APP_ID}/workspaces/${WS_ID}`]: { exists: true, data: () => ({ type: opts.wsType, ownerId: opts.ownerUid ?? "uid-owner" }) },
  };
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => docs[path] ?? { exists: false, data: () => ({}) },
      update: async (data: Record<string, unknown>) => { updates.push({ path, data }); },
    }),
    collection: (path: string) => ({
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members`) {
          return { docs: [{ id: opts.ownerUid ?? "uid-owner", ref: { path: `${path}/${opts.ownerUid ?? "uid-owner"}`, update: async (d: Record<string, unknown>) => updates.push({ path: `${path}/${opts.ownerUid ?? "uid-owner"}`, data: d }) } }] };
        }
        return { docs: [] };
      },
    }),
  };
  return { db: db as unknown as Parameters<typeof syncOnTeamCreate>[0]["db"], updates };
}

describe("syncOnTeamCreate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("personal workspace: arrayUnion teamId on the single member", async () => {
    const { db, updates } = makeDb({ wsType: "personal" });
    await syncOnTeamCreate({ db, appId: APP_ID, wsId: WS_ID, teamId: TEAM_ID });
    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-owner`);
    expect(updates[0].data.assignedTeamIds).toBeTruthy();
  });

  it("club workspace: no-op", async () => {
    const { db, updates } = makeDb({ wsType: "club" });
    await syncOnTeamCreate({ db, appId: APP_ID, wsId: WS_ID, teamId: TEAM_ID });
    expect(updates).toHaveLength(0);
  });
});
