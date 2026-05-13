import { describe, expect, it } from "vitest";
import { buildTeamsDigest } from "../../digest/teamsDigest";

/**
 * Tests focales del builder de teams. Verifica contrato:
 * - lee `teams` del workspace
 * - hace count de `members` sub-collection
 * - formatea name con formatTeamDisplayName
 */

interface DocSnapStub {
  id: string;
  data: () => Record<string, unknown>;
  ref: { collection: (name: string) => unknown };
}

function makeDb(teams: Array<{ id: string; data: Record<string, unknown>; memberCount: number }>) {
  const docs: DocSnapStub[] = teams.map((t) => ({
    id: t.id,
    data: () => t.data,
    ref: {
      collection: (_name: string) => ({
        count: () => ({
          get: async () => ({ data: () => ({ count: t.memberCount }) }),
        }),
      }),
    },
  }));

  return {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({
            collection: (name: string) => {
              if (name === "teams") {
                return { get: async () => ({ docs }) };
              }
              return { get: async () => ({ docs: [] }) };
            },
          }),
        }),
      }),
    }),
  };
}

describe("buildTeamsDigest", () => {
  it("returns teams with name + categoria + nivel + memberCount", async () => {
    const db = makeDb([
      {
        id: "t1",
        data: { teamName: "Juniors", categoria: "junior", nivel: "B", letra: "B" },
        memberCount: 12,
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildTeamsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
    expect(result[0].categoria).toBe("junior");
    expect(result[0].nivel).toBe("B");
    expect(result[0].memberCount).toBe(12);
    expect(result[0].name.length).toBeGreaterThan(0);
  });

  it("returns empty array when no teams exist", async () => {
    const db = makeDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildTeamsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result).toEqual([]);
  });

  it("falls back to '(sin nombre)' when team has no name fields", async () => {
    const db = makeDb([{ id: "t1", data: {}, memberCount: 0 }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildTeamsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result[0].name).toBe("(sin nombre)");
  });
});
