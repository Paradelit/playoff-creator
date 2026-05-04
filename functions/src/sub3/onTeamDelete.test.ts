import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupAfterTeamDelete } from "./onTeamDelete";

const APP_ID = "app-test"; const WS_ID = "ws-1"; const TEAM_ID = "team-deleted";

function makeDb(opts: { granteePaths?: string[]; memberIds?: string[] } = {}) {
  const ops: Array<{ kind: "delete"|"update"; path: string; data?: Record<string, unknown> }> = [];
  const db = {
    collection: (path: string) => ({
      get: async () => {
        if (path.includes(`/teams/${TEAM_ID}/grants`) && !path.endsWith("/grantees")) {
          return { docs: [{ id: "asistencia", ref: { path: `${path}/asistencia` } }] };
        }
        if (path.includes("/grantees")) {
          return { docs: (opts.granteePaths ?? []).map(p => ({ ref: { path: p, delete: async () => ops.push({ kind: "delete", path: p }) } })) };
        }
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members`) {
          return { docs: (opts.memberIds ?? ["uid-A", "uid-B"]).map(id => ({
            id, ref: { path: `${path}/${id}`, update: async (d: Record<string, unknown>) => ops.push({ kind: "update", path: `${path}/${id}`, data: d }) },
          })) };
        }
        return { docs: [] };
      },
    }),
  };
  return { db: db as unknown as Parameters<typeof cleanupAfterTeamDelete>[0]["db"], ops };
}

describe("cleanupAfterTeamDelete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes grantees + arrayRemove on every member", async () => {
    const { db, ops } = makeDb({
      granteePaths: [`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/${TEAM_ID}/grants/asistencia/grantees/uid-X`],
      memberIds: ["uid-A", "uid-B"],
    });
    await cleanupAfterTeamDelete({ db, appId: APP_ID, wsId: WS_ID, teamId: TEAM_ID });
    expect(ops.filter(o => o.kind === "delete")).toHaveLength(1);
    expect(ops.filter(o => o.kind === "update")).toHaveLength(2);
    for (const u of ops.filter(o => o.kind === "update")) {
      expect(u.data!.assignedTeamIds).toBeTruthy();
    }
  });

  it("no grantees: still arrayRemoves from members", async () => {
    const { db, ops } = makeDb({ granteePaths: [], memberIds: ["uid-A"] });
    await cleanupAfterTeamDelete({ db, appId: APP_ID, wsId: WS_ID, teamId: TEAM_ID });
    expect(ops.filter(o => o.kind === "delete")).toHaveLength(0);
    expect(ops.filter(o => o.kind === "update")).toHaveLength(1);
  });
});
