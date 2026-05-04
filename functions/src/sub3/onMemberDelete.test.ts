import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupAfterMemberDelete } from "./onMemberDelete";

const APP_ID = "app-test"; const WS_ID = "ws-1";

function makeDb(state: { grantees?: Array<{ path: string; data: Record<string, unknown> }>; invites?: Array<{ path: string; data: Record<string, unknown> }> }) {
  const deletes: string[] = [];
  const collectionGroup = vi.fn((name: string) => ({
    where: vi.fn().mockImplementation(function chain(this: unknown) {
      return {
        where: chain.bind(this),
        get: async () => {
          if (name === "grantees") return { docs: (state.grantees ?? []).map(d => ({ ref: { path: d.path, delete: async () => { deletes.push(d.path); } } })) };
          if (name === "invites") return { docs: (state.invites ?? []).map(d => ({ ref: { path: d.path, delete: async () => { deletes.push(d.path); } } })) };
          return { docs: [] };
        },
      };
    }),
  }));
  const db = { collectionGroup } as unknown as Parameters<typeof cleanupAfterMemberDelete>[0]["db"];
  return { db, deletes };
}

describe("cleanupAfterMemberDelete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes grants (grantedBy + grantedTo) and invites of the deleted member", async () => {
    const { db, deletes } = makeDb({
      grantees: [
        { path: `artifacts/${APP_ID}/workspaces/${WS_ID}/teams/T/grants/asistencia/grantees/uid-deleted`,
          data: { workspaceId: WS_ID, grantedTo: "uid-deleted", grantedBy: "uid-other" } },
      ],
      invites: [
        { path: `artifacts/${APP_ID}/workspaces/${WS_ID}/invites/inv-1`,
          data: { workspaceId: WS_ID, invitedBy: "uid-deleted" } },
      ],
    });
    await cleanupAfterMemberDelete({ db, appId: APP_ID, wsId: WS_ID, memberUid: "uid-deleted" });
    expect(deletes.length).toBeGreaterThanOrEqual(2);
  });

  it("no-op when no grants/invites match", async () => {
    const { db, deletes } = makeDb({});
    await cleanupAfterMemberDelete({ db, appId: APP_ID, wsId: WS_ID, memberUid: "uid-deleted" });
    expect(deletes).toHaveLength(0);
  });
});
