import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { runCleanupExpiredInvites } from "./cleanupExpiredInvites";

function tsMs(ms: number) { return { toMillis: () => ms } as unknown as Timestamp; }

const NOW_MS = 1_700_000_000_000;
beforeEach(() => vi.useFakeTimers().setSystemTime(NOW_MS));

describe("runCleanupExpiredInvites", () => {
  it("deletes only invites whose expiresAt < now", async () => {
    const deletes: string[] = [];
    const expired = { ref: { path: "a/expired", delete: async () => { deletes.push("a/expired"); } }, data: () => ({ expiresAt: tsMs(NOW_MS - 1000) }) };
    const fresh   = { ref: { path: "b/fresh",   delete: async () => { deletes.push("b/fresh"); }   }, data: () => ({ expiresAt: tsMs(NOW_MS + 60_000) }) };
    const db = {
      collectionGroup: () => ({
        where: () => ({ get: async () => ({ docs: [expired] }) }),
      }),
    };
    const result = await runCleanupExpiredInvites({ db: db as unknown as Parameters<typeof runCleanupExpiredInvites>[0]["db"] });
    expect(deletes).toEqual(["a/expired"]);
    expect(result.deleted).toBe(1);
    expect(fresh.ref.path).toBe("b/fresh");
  });
});
