import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleCreateClub } from "./createClub";

vi.mock("./clubAllowlist", () => ({
  isInClubAllowlist: (uid: string) => uid === "uid-allowed",
}));

const APP_ID = "app-test";

function makeDb() {
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  let n = 0;
  const batch = {
    set: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
      writes.push({ path: ref.path, data });
      return batch;
    }),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  const db = {
    batch: () => batch,
    collection: (path: string) => ({
      doc: () => { n++; return { id: `gen-${n}`, path: `${path}/gen-${n}` }; },
    }),
    doc: (path: string) => ({ path }),
  };
  return { db: db as unknown as Parameters<typeof handleCreateClub>[0]["db"], writes, batch };
}

describe("handleCreateClub", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects uid not in allowlist", async () => {
    const { db } = makeDb();
    await expect(handleCreateClub({
      db, appId: APP_ID,
      auth: { uid: "uid-stranger", displayName: "X", email: "x@x.com" },
      data: { name: "Mi Club" },
    })).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects empty name", async () => {
    const { db } = makeDb();
    await expect(handleCreateClub({
      db, appId: APP_ID,
      auth: { uid: "uid-allowed", displayName: "S", email: "s@s.com" },
      data: { name: "   " },
    })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects name >80 chars", async () => {
    const { db } = makeDb();
    await expect(handleCreateClub({
      db, appId: APP_ID,
      auth: { uid: "uid-allowed", displayName: "S", email: "s@s.com" },
      data: { name: "x".repeat(81) },
    })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("happy path writes 3 docs atomically and returns wsId", async () => {
    const { db, writes, batch } = makeDb();
    const result = await handleCreateClub({
      db, appId: APP_ID,
      auth: { uid: "uid-allowed", displayName: "Sergio", email: "s@s.com" },
      data: { name: "Uros de Rivas" },
    });
    expect(result.wsId).toBe("gen-1");
    expect(batch.commit).toHaveBeenCalledOnce();
    expect(writes).toHaveLength(3);
    const ws = writes.find(w => w.path.endsWith("/workspaces/gen-1"))!;
    expect(ws.data).toMatchObject({ type: "club", ownerId: "uid-allowed", name: "Uros de Rivas", plan: "free" });
    const member = writes.find(w => w.path.endsWith("/members/uid-allowed"))!;
    expect(member.data).toMatchObject({
      role: "dt", assignedTeamIds: [], displayName: "Sergio", email: "s@s.com", invitedBy: null,
    });
    const membership = writes.find(w => w.path.endsWith("/memberships/gen-1"))!;
    expect(membership.data).toMatchObject({
      workspaceType: "club", workspaceName: "Uros de Rivas", role: "dt",
    });
  });
});
