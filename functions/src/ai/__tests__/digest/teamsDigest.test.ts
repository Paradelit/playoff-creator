import { describe, expect, it } from "vitest";
import { buildTeamsDigest } from "../../digest/teamsDigest";

/**
 * Tests focales del builder de teams. Verifica contrato:
 * - lee `teams` del workspace
 * - lee `members` sub-collection (memberCount + rosterSnapshot)
 * - formatea name con formatTeamDisplayName
 * - aplica scopedTeamIds + enriquece via maps de sessions (sub-A.2 + A.3)
 */

interface DocSnapStub {
  id: string;
  data: () => Record<string, unknown>;
  ref: { collection: (name: string) => unknown };
}

interface MemberStub {
  id: string;
  data: Record<string, unknown>;
}

function makeDb(
  teams: Array<{ id: string; data: Record<string, unknown>; members?: MemberStub[] }>
) {
  const docs: DocSnapStub[] = teams.map((t) => ({
    id: t.id,
    data: () => t.data,
    ref: {
      collection: (name: string) => {
        if (name === "members") {
          const memberDocs = (t.members || []).map((m) => ({ id: m.id, data: () => m.data }));
          return { get: async () => ({ docs: memberDocs }) };
        }
        return { get: async () => ({ docs: [] }) };
      },
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
        members: [
          { id: "p1", data: { tipo: "jugador", nombre: "A" } },
          { id: "p2", data: { tipo: "jugador", nombre: "B" } },
          { id: "s1", data: { tipo: "entrenador", nombre: "Coach" } },
        ],
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildTeamsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
    expect(result[0].categoria).toBe("junior");
    expect(result[0].nivel).toBe("B");
    expect(result[0].memberCount).toBe(3);
    expect(result[0].name.length).toBeGreaterThan(0);
  });

  it("returns empty array when no teams exist", async () => {
    const db = makeDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildTeamsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result).toEqual([]);
  });

  it("falls back to '(sin nombre)' when team has no name fields", async () => {
    const db = makeDb([{ id: "t1", data: {} }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildTeamsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result[0].name).toBe("(sin nombre)");
  });

  it("rosterSnapshot includes only tipo=jugador, sorted by dorsal, max 12", async () => {
    const members: MemberStub[] = [
      // 14 jugadores con dorsal mezclado + 1 staff
      ...Array.from({ length: 14 }, (_, i) => ({
        id: `p${i}`,
        data: { tipo: "jugador", nombre: `Jugador${i}`, dorsal: String(14 - i), posicion: "base" },
      })),
      { id: "staff1", data: { tipo: "entrenador", nombre: "Coach" } },
    ];
    const db = makeDb([{ id: "t1", data: { teamName: "X" }, members }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildTeamsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result[0].memberCount).toBe(15); // jugadores + staff
    expect(result[0].rosterSnapshot).toHaveLength(12);
    expect(result[0].rosterSnapshot![0].dorsal).toBe("1");
    expect(result[0].rosterSnapshot![11].dorsal).toBe("12");
    // El jugador con dorsal 13/14 y el staff están fuera del snapshot.
  });

  it("rosterSnapshot is omitted when there are 0 jugadores", async () => {
    const db = makeDb([
      {
        id: "t1",
        data: { teamName: "X" },
        members: [{ id: "s", data: { tipo: "entrenador", nombre: "Coach" } }],
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildTeamsDigest({ db: db as any, appId: "a", wsId: "w" });
    expect(result[0].rosterSnapshot).toBeUndefined();
  });

  it("scopedTeamIds filters teams before reading members", async () => {
    const db = makeDb([
      { id: "t1", data: { teamName: "A" }, members: [{ id: "p1", data: { tipo: "jugador" } }] },
      { id: "t2", data: { teamName: "B" }, members: [{ id: "p2", data: { tipo: "jugador" } }] },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildTeamsDigest({
      db: db as any,
      appId: "a",
      wsId: "w",
      scopedTeamIds: new Set(["t2"]),
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t2");
  });

  it("nextSession + lastResult come from passed maps", async () => {
    const db = makeDb([{ id: "t1", data: { teamName: "X" }, members: [] }]);
    const upcomingByTeam = new Map<string, ReturnType<typeof Object>>([
      ["t1", [{ id: "s1", fecha: "2026-05-20", tipo: "partido", rival: "Hispano" }]],
    ]);
    const recentByTeam = new Map<string, ReturnType<typeof Object>>([
      [
        "t1",
        [
          {
            id: "s0",
            fecha: "2026-05-10",
            tipo: "partido",
            rival: "Otros",
            result: { ourScore: 65, theirScore: 60 },
          },
        ],
      ],
    ]);
    const result = await buildTeamsDigest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      upcomingSessionsByTeam: upcomingByTeam as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentPastSessionsByTeam: recentByTeam as any,
    });
    expect(result[0].nextSession).toMatchObject({ id: "s1", rival: "Hispano" });
    expect(result[0].lastResult).toMatchObject({ ourScore: 65, theirScore: 60, rival: "Otros" });
  });
});
