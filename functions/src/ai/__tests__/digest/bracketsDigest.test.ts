import { describe, expect, it } from "vitest";
import { buildBracketsDigest } from "../../digest/bracketsDigest";

interface DocSnapStub {
  id: string;
  data: () => Record<string, unknown>;
}

function makeDb(brackets: Array<{ id: string; data: Record<string, unknown> }>) {
  const docs: DocSnapStub[] = brackets.map((b) => ({ id: b.id, data: () => b.data }));
  return {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({
            collection: (name: string) => {
              if (name === "brackets") return { get: async () => ({ docs }) };
              return { get: async () => ({ docs: [] }) };
            },
          }),
        }),
      }),
    }),
  };
}

describe("buildBracketsDigest", () => {
  it("returns brackets with id + name + teamId", async () => {
    const db = makeDb([{ id: "b1", data: { name: "Liga 2026", teamId: "t1" } }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildBracketsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result).toEqual([{ id: "b1", name: "Liga 2026", teamId: "t1" }]);
  });

  it("uses tournamentName when name is missing", async () => {
    const db = makeDb([{ id: "b1", data: { tournamentName: "Copa" } }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildBracketsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result[0].name).toBe("Copa");
  });

  it("falls back to 'Playoff' when no name fields", async () => {
    const db = makeDb([{ id: "b1", data: {} }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildBracketsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result[0].name).toBe("Playoff");
  });

  it("returns teamId=null when missing", async () => {
    const db = makeDb([{ id: "b1", data: { name: "X" } }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildBracketsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result[0].teamId).toBeNull();
  });
});
