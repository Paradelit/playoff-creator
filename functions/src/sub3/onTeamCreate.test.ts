import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncOnTeamCreate } from "./onTeamCreate";

const APP_ID = "app-test";
const WS_ID = "ws-1";
const TEAM_ID = "team-new";

function makeDb(opts: {
  wsType: "personal" | "club";
  ownerUid?: string;
  memberExists?: { uid: string; exists: boolean }[]; // para testear createdBy en club
}) {
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const ownerUid = opts.ownerUid ?? "uid-owner";
  const docs: Record<string, { exists: boolean; data: () => Record<string, unknown> }> = {
    [`artifacts/${APP_ID}/workspaces/${WS_ID}`]: {
      exists: true,
      data: () => ({ type: opts.wsType, ownerId: ownerUid }),
    },
  };
  const memberOverrides = new Map(opts.memberExists?.map((m) => [m.uid, m.exists]));
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => {
        if (docs[path]) return docs[path];
        // Member existence check (club path: /members/{uid})
        const m = path.match(/\/members\/([^/]+)$/);
        if (m) {
          const exists = memberOverrides.has(m[1]) ? memberOverrides.get(m[1])! : true;
          return { exists, data: () => ({}) };
        }
        return { exists: false, data: () => ({}) };
      },
      update: async (data: Record<string, unknown>) => {
        updates.push({ path, data });
      },
    }),
    collection: (path: string) => ({
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members`) {
          return {
            docs: [
              {
                id: ownerUid,
                ref: {
                  path: `${path}/${ownerUid}`,
                  update: async (d: Record<string, unknown>) =>
                    updates.push({ path: `${path}/${ownerUid}`, data: d }),
                },
              },
            ],
          };
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

  it("club workspace: arrayUnion teamId al createdBy del team", async () => {
    const { db, updates } = makeDb({ wsType: "club", ownerUid: "uid-owner" });
    await syncOnTeamCreate({
      db,
      appId: APP_ID,
      wsId: WS_ID,
      teamId: TEAM_ID,
      team: { createdBy: "uid-dt-rama" },
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-dt-rama`);
    expect(updates[0].data.assignedTeamIds).toBeTruthy();
  });

  it("club workspace sin createdBy: fallback al ownerId del workspace", async () => {
    const { db, updates } = makeDb({ wsType: "club", ownerUid: "uid-owner" });
    await syncOnTeamCreate({ db, appId: APP_ID, wsId: WS_ID, teamId: TEAM_ID });
    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-owner`);
  });

  it("club workspace con createdBy que NO es member: no-op", async () => {
    const { db, updates } = makeDb({
      wsType: "club",
      ownerUid: "uid-owner",
      memberExists: [{ uid: "uid-stranger", exists: false }],
    });
    await syncOnTeamCreate({
      db,
      appId: APP_ID,
      wsId: WS_ID,
      teamId: TEAM_ID,
      team: { createdBy: "uid-stranger" },
    });
    expect(updates).toHaveLength(0);
  });
});
